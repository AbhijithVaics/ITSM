"""
Microsoft Graph API Client using MSAL.
Provides fallback to mock implementations when client credentials are not configured.
"""

import datetime
import uuid
import httpx
import msal
import structlog
from typing import Dict, Any, Optional

from app.core.config import settings

logger = structlog.get_logger()


class GraphClient:
    """
    Client for interacting with MS Graph API.
    Handles tenant authentication (client credentials flow) and subscriptions.
    """

    def __init__(self):
        self.tenant_id = settings.GRAPH_TENANT_ID
        self.client_id = settings.GRAPH_CLIENT_ID
        self.client_secret = settings.GRAPH_CLIENT_SECRET
        self.mailbox = settings.GRAPH_MAILBOX
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.scopes = ["https://graph.microsoft.com/.default"]

        self._msal_app: Optional[msal.ConfidentialClientApplication] = None
        self.is_mock = not (self.client_id and self.client_secret and self.tenant_id)

        if self.is_mock:
            logger.info("MS Graph Client initialized in MOCK mode (credentials missing)")
        else:
            logger.info("MS Graph Client initialized in LIVE mode", client_id=self.client_id)
            self._msal_app = msal.ConfidentialClientApplication(
                self.client_id,
                client_credential=self.client_secret,
                authority=self.authority,
            )

    def _get_access_token(self) -> str:
        """Acquire a token from MSAL cache or tenant endpoint."""
        if self.is_mock:
            return "mock-access-token"

        assert self._msal_app is not None
        result = self._msal_app.acquire_token_silent(self.scopes, account=None)
        if not result:
            result = self._msal_app.acquire_token_for_client(scopes=self.scopes)

        if "access_token" in result:
            return result["access_token"]
        
        error_msg = result.get("error_description", result.get("error", "Unknown token acquisition error"))
        raise RuntimeError(f"Failed to acquire MS Graph access token: {error_msg}")

    def get_message(self, mailbox: str, message_id: str) -> Dict[str, Any]:
        """Fetch email details from the specified mailbox."""
        if self.is_mock:
            logger.info("Mock GraphClient.get_message called", mailbox=mailbox, message_id=message_id)
            return {
                "id": message_id,
                "subject": f"Simulated Inbound Ticket - {datetime.date.today()}",
                "body": {
                    "contentType": "text",
                    "content": "This is a simulated support request email body. VPN is down."
                },
                "bodyPreview": "This is a simulated support request email body. VPN is down.",
                "from": {
                    "emailAddress": {
                        "name": "Demo User",
                        "address": "user1@company.com"
                    }
                },
                "receivedDateTime": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        url = f"https://graph.microsoft.com/v1.0/users/{mailbox}/messages/{message_id}"

        with httpx.Client() as client:
            r = client.get(url, headers=headers)
            if r.status_code != 200:
                logger.error("Failed to fetch message from MS Graph", status_code=r.status_code, response=r.text)
                r.raise_for_status()
            return r.json()

    def send_mail(self, to: str, subject: str, body: str) -> None:
        """Send an email outbound through settings.GRAPH_MAILBOX."""
        from_mailbox = self.mailbox or "service-desk@company.com"
        
        if self.is_mock:
            logger.info(
                "Mock GraphClient.send_mail called",
                from_mailbox=from_mailbox,
                to=to,
                subject=subject,
                body_length=len(body)
            )
            return

        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        url = f"https://graph.microsoft.com/v1.0/users/{from_mailbox}/sendMail"

        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": body
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": to
                        }
                    }
                ]
            },
            "saveToSentItems": "true"
        }

        with httpx.Client() as client:
            r = client.post(url, headers=headers, json=payload)
            if r.status_code != 202:
                logger.error("Failed to send email via MS Graph", status_code=r.status_code, response=r.text)
                r.raise_for_status()

    def create_subscription(self, mailbox: str, webhook_url: str, client_state: str) -> Dict[str, Any]:
        """Create a webhook subscription for new messages in a mailbox."""
        # Max expiration for Graph messages is 4230 minutes (~2.9 days)
        expiration = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)
        expiration_str = expiration.isoformat().replace("+00:00", "Z")

        if self.is_mock:
            sub_id = str(uuid.uuid4())
            logger.info(
                "Mock GraphClient.create_subscription called",
                mailbox=mailbox,
                webhook_url=webhook_url,
                subscription_id=sub_id
            )
            return {
                "id": sub_id,
                "resource": f"users/{mailbox}/mailFolders/Inbox/messages",
                "changeType": "created",
                "notificationUrl": webhook_url,
                "expirationDateTime": expiration_str,
                "clientState": client_state,
            }

        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        url = "https://graph.microsoft.com/v1.0/subscriptions"

        payload = {
            "changeType": "created",
            "notificationUrl": webhook_url,
            "resource": f"users/{mailbox}/mailFolders/Inbox/messages",
            "expirationDateTime": expiration_str,
            "clientState": client_state,
            "latestSupportedTlsVersion": "v1_2"
        }

        with httpx.Client() as client:
            r = client.post(url, headers=headers, json=payload)
            if r.status_code != 201:
                logger.error("Failed to create Graph subscription", status_code=r.status_code, response=r.text)
                r.raise_for_status()
            return r.json()

    def renew_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Renew an existing webhook subscription by updating its expiry date."""
        expiration = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)
        expiration_str = expiration.isoformat().replace("+00:00", "Z")

        if self.is_mock:
            logger.info("Mock GraphClient.renew_subscription called", subscription_id=subscription_id)
            return {
                "id": subscription_id,
                "expirationDateTime": expiration_str,
            }

        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        url = f"https://graph.microsoft.com/v1.0/subscriptions/{subscription_id}"

        payload = {
            "expirationDateTime": expiration_str
        }

        with httpx.Client() as client:
            r = client.patch(url, headers=headers, json=payload)
            if r.status_code != 200:
                logger.error("Failed to renew Graph subscription", subscription_id=subscription_id, status_code=r.status_code, response=r.text)
                r.raise_for_status()
            return r.json()


# Single instance exporter
graph_client = GraphClient()
