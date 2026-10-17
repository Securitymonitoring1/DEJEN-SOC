from dejen_agent.macos import parse_macos_log_records


def test_parse_macos_ssh_failure_log_record():
    events = parse_macos_log_records(
        [
            {
                "timestamp": "2026-10-16T09:00:00Z",
                "eventMessage": "Failed password for invalid user lab-no-such-user from 192.0.2.7 port 5022 ssh2",
            },
            {"timestamp": "2026-10-16T09:00:01Z", "eventMessage": "Connection closed"},
        ],
        agent_id="mac-lab",
        host="macbook-lab",
    )

    assert len(events) == 1
    assert events[0]["event_type"] == "LOGIN_FAILURE"
    assert events[0]["agent_id"] == "mac-lab"
    assert events[0]["source_ip"] == "192.0.2.7"
    assert events[0]["timestamp"] == "2026-10-16T09:00:00+00:00"