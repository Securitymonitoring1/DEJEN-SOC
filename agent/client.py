"""HTTP client for sending security events to Dejen."""

import json
import urllib.error
import urllib.request


class EventSendError(Exception):
    """Raised when Dejen cannot accept an event."""


def send_event(event: dict, api_url: str, token: str) -> dict:
    """Send one event to the Dejen API and return its response."""
    if not token:
        raise EventSendError(
            "Missing API token. Set DEJEN_API_TOKEN before sending events."
        )

    url = f"{api_url.rstrip('/')}/events"
    payload = json.dumps(event).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code == 401:
            reason = "Authentication failed: token is invalid or expired."
        elif error.code == 403:
            reason = "Permission denied: account needs ADMIN or ANALYST role."
        elif error.code == 422:
            reason = "Event rejected: check the event fields and values."
        else:
            reason = f"Dejen API returned HTTP {error.code}."
        raise EventSendError(reason) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise EventSendError(
            f"Cannot connect to Dejen API at {url}."
        ) from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise EventSendError(
            "Dejen returned an invalid JSON response."
        ) from error