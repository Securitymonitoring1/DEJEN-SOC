import json
import unittest
from types import SimpleNamespace

from collectors.common.events import build_event
from collectors.sender.kafka import DeliveryError, KafkaEventProducer, ProducerConfig


class Future:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error

    def get(self, timeout):
        if self.error:
            raise self.error
        return self.result


class MockProducer:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = []
        self.closed = False

    def send(self, topic, value):
        self.calls.append((topic, value))
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    def flush(self, timeout):
        pass

    def close(self, timeout):
        self.closed = True


def sample_event():
    return build_event(
        agent_id="test-agent",
        host="test-host",
        event_type="process_start",
        message="process started",
    )


class KafkaProducerTests(unittest.TestCase):
    def test_publishes_json_and_waits_for_acknowledgement(self):
        metadata = SimpleNamespace(partition=0, offset=42)
        producer = MockProducer([Future(metadata)])
        sender = KafkaEventProducer(ProducerConfig(), producer=producer)
        event = sample_event()
        result = sender.send_event(event)
        self.assertIs(result, metadata)
        topic, payload = producer.calls[0]
        self.assertEqual(topic, "dejen-security-events")
        self.assertEqual(json.loads(payload), event)

    def test_retries_failed_delivery_and_keeps_event_id_stable(self):
        producer = MockProducer([OSError("broker unavailable"), Future("ack")])
        sender = KafkaEventProducer(
            ProducerConfig(retries=1, retry_backoff_seconds=0.1),
            producer=producer,
            sleep=lambda _seconds: None,
        )
        event = sample_event()
        sender.send_event(event)
        self.assertEqual(len(producer.calls), 2)
        self.assertEqual(producer.calls[0][1], producer.calls[1][1])

    def test_raises_after_exhausting_retries(self):
        producer = MockProducer([OSError("down"), OSError("still down")])
        sender = KafkaEventProducer(
            ProducerConfig(retries=1, retry_backoff_seconds=0),
            producer=producer,
            sleep=lambda _seconds: None,
        )
        with self.assertRaisesRegex(DeliveryError, "2 attempt"):
            sender.send_event(sample_event())

    def test_rejects_invalid_json_before_delivery(self):
        producer = MockProducer([])
        sender = KafkaEventProducer(ProducerConfig(retries=0), producer=producer)
        event = sample_event()
        event["raw"] = {"not_serializable": object()}
        with self.assertRaisesRegex(DeliveryError, "not JSON serializable"):
            sender.send_event(event)
        self.assertEqual(producer.calls, [])

    def test_requires_credentials_for_sasl(self):
        with self.assertRaisesRegex(ValueError, "SASL requires"):
            ProducerConfig(security_protocol="SASL_SSL")


if __name__ == "__main__":
    unittest.main()