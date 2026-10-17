# Syslog Receiver

`collectors.syslog.parser.parse_syslog_message` handles RFC 3164 and RFC 5424. It extracts priority/facility, timestamp, hostname, app/process ID, structured data, and message. SSH authentication messages are normalized to `authentication_failed` or `authentication_success`; other records use `syslog_message`. The original record and sender address are retained in `raw`.

`collectors.syslog.receiver.SyslogReceiver` supports UDP and newline-delimited TCP. Its default bind is `127.0.0.1:5514/udp`; it does not expose an unauthenticated receiver to the network by default.

## Run

```sh
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Set `REDPANDA_BROKERS` and `REDPANDA_TOPIC`, then configure `SYSLOG_HOST`, `SYSLOG_PORT`, and `SYSLOG_PROTOCOL` (`udp` or `tcp`) in `.env` and run:

```sh
python -m collectors.syslog.main
```

Local UDP smoke test:

```sh
python -c 'import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.sendto(b"<34>Oct 15 10:00:00 host01 sshd[321]: Failed password for admin from 192.0.2.8 port 22 ssh2", ("127.0.0.1",5514)); s.close()'
```

## Verify and secure

```sh
python -m unittest tests/test_syslog_parser.py tests/test_syslog_receiver.py -v
```

Malformed or oversized TCP records are discarded and logged. RFC 3164 does not carry a year or timezone, so its year is inferred relative to receive time and UTC is used; RFC 5424 timestamps must include an offset. For remote devices, bind only on a protected interface, restrict the port with a host/network firewall, and use a trusted network or tunnel. This receiver does not provide TLS or sender authentication. UDP delivery is best-effort; the callback reports broker failures, but the UDP sender cannot be asked to retransmit.