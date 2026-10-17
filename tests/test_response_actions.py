import unittest
import tempfile
from pathlib import Path
from unittest.mock import call, patch

from dejen_agent.response import ActionReceiptStore, ResponseActionError, execute_endpoint_action


class ResponseActionTests(unittest.TestCase):
    action_id = "9e19aab5-c568-4b01-990a-54ce3705f14a"

    def test_windows_block_adds_inbound_and_outbound_firewall_rules(self):
        action = {
            "action_id": self.action_id,
            "action_type": "BLOCK_ENDPOINT_IP",
            "target_ip": "192.0.2.44",
        }
        with patch("dejen_agent.response.platform.system", return_value="Windows"), patch(
            "dejen_agent.response._run"
        ) as run:
            self.assertFalse(execute_endpoint_action(action))

        command = run.call_args.args[0][-1]
        self.assertIn("192.0.2.44", command)
        self.assertIn("Direction Inbound", command)
        self.assertIn("Direction Outbound", command)
        self.assertIn("-LocalAddress $ip", command)
        self.assertNotIn("-RemoteAddress", command)

    def test_linux_isolation_disables_active_interfaces_but_not_loopback(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch("dejen_agent.response.platform.system", return_value="Linux"), patch(
                "dejen_agent.response._run",
                side_effect=["1: lo: <LOOPBACK,UP>\n2: eth0: <BROADCAST,UP>\n3: wlan0: <UP>" , "", ""],
            ) as run:
                self.assertFalse(
                    execute_endpoint_action(
                        {"action_id": self.action_id, "action_type": "ISOLATE_ENDPOINT"},
                        state_dir=temporary,
                    )
                )

        self.assertEqual(
            run.call_args_list[1:],
            [call(["ip", "link", "set", "dev", "eth0", "down"]), call(["ip", "link", "set", "dev", "wlan0", "down"])],
        )

    def test_disconnect_disables_windows_startup_task_and_requests_stop(self):
        with patch("dejen_agent.response.platform.system", return_value="Windows"), patch(
            "dejen_agent.response._run"
        ) as run:
            should_stop = execute_endpoint_action(
                {"action_id": self.action_id, "action_type": "DISCONNECT_AGENT"}
            )

        self.assertTrue(should_stop)
        self.assertIn("Disable-ScheduledTask", run.call_args.args[0][-1])

    def test_invalid_ip_is_rejected_without_running_commands(self):
        with patch("dejen_agent.response.platform.system", return_value="Windows"), patch(
            "dejen_agent.response._run"
        ) as run:
            with self.assertRaises(ResponseActionError):
                execute_endpoint_action(
                    {
                        "action_id": self.action_id,
                        "action_type": "BLOCK_ENDPOINT_IP",
                        "target_ip": "not-an-ip",
                    }
                )
        run.assert_not_called()

    def test_action_receipt_survives_store_recreation(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "action_receipts.json"
            store = ActionReceiptStore(path)
            receipt = {"status": "SUCCEEDED", "result": "isolated", "stop_agent": False}

            store.save(self.action_id, receipt)
            restored = ActionReceiptStore(path)
            self.assertEqual(restored.get(self.action_id), receipt)

            restored.remove(self.action_id)
            self.assertIsNone(ActionReceiptStore(path).get(self.action_id))

    def test_unisolate_restores_only_interfaces_saved_by_isolate(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch("dejen_agent.response.platform.system", return_value="Windows"), patch(
                "dejen_agent.response._run",
                side_effect=['["Ethernet"]', "", ""],
            ) as run:
                execute_endpoint_action(
                    {"action_id": self.action_id, "action_type": "ISOLATE_ENDPOINT"},
                    state_dir=temporary,
                )
                execute_endpoint_action(
                    {"action_id": self.action_id, "action_type": "UNISOLATE_ENDPOINT"},
                    state_dir=temporary,
                )

        self.assertIn("Disable-NetAdapter -Name 'Ethernet'", run.call_args_list[1].args[0][-1])
        self.assertIn("Enable-NetAdapter -Name 'Ethernet'", run.call_args_list[2].args[0][-1])

    def test_unblock_only_removes_dejen_rules_for_local_endpoint_address(self):
        action = {
            "action_id": self.action_id,
            "action_type": "UNBLOCK_ENDPOINT_IP",
            "target_ip": "192.0.2.44",
        }
        with patch("dejen_agent.response.platform.system", return_value="Windows"), patch(
            "dejen_agent.response._run"
        ) as run:
            execute_endpoint_action(action)

        command = run.call_args.args[0][-1]
        self.assertIn("DejenBlock-*", command)
        self.assertIn("$filter.LocalAddress -contains $ip", command)
        self.assertNotIn("RemoteAddress", command)


if __name__ == "__main__":
    unittest.main()