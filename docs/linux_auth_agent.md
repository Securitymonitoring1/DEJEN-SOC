# Linux SSH Authentication Agent

The root-level `agent/` package tails a Linux authentication log, parses SSH password/public-key successes and failures, and posts recognized events directly to the Dejen backend. It is separate from `collectors/agent/`, which contains other collector utilities.

## Configure and run

Install project requirements and create `.env` without replacing an existing file:

```sh
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Set `DEJEN_API_URL`, `DEJEN_AUTH_LOG`, and `DEJEN_POLL_INTERVAL`. Obtain a bearer token by posting account credentials to `POST /auth/login`, then set it as `DEJEN_API_TOKEN` in the untracked `.env`. The account needs the `ADMIN` or `ANALYST` role. Never commit the token. On distributions that use `/var/log/secure` instead of `/var/log/auth.log`, configure that path. Run as an account with read access to the authentication log:

```sh
python -m agent.main
```

At startup, the agent seeks to the end of the existing file and processes only new complete lines. It handles log rotation/truncation and prints parsed events. Without a token it operates in print-only mode.

## Test

```sh
python -m unittest tests/agent/test_authlog.py tests/agent/test_log_reader.py -v
python -m unittest discover -s tests -t . -v
```

The agent sends directly to the backend `/events` API, not Redpanda. The backend assigns the event timestamp on receipt; the original log line is preserved as the message. Failed HTTP delivery is reported but the current agent does not persist/retry already-read lines, so use a reliable local backend connection or add a durable queue before production deployment.