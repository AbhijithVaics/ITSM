"""
Email thread matcher: match incoming emails to existing incidents or changes.
"""

import re
from typing import Optional
from sqlalchemy.orm import Session

from app.models.work_item import WorkItem
from app.models.email import EmailMessage

# Matches INC-YYYYMMDD-XXXX or CHG-YYYYMMDD-XXXX
REF_PATTERN = re.compile(r"\b(INC|CHG)-\d{8}-\d{4}\b", re.IGNORECASE)


class EmailThreadMatcher:
    """
    Utility service to identify if an inbound email belongs to an existing work item.
    Enforces two strategies:
    1. Direct Regex Reference Extraction: Scan subject and body for INC/CHG ticket markers.
    2. Header Thread Mapping: Check In-Reply-To / References headers against previously processed email messages.
    """

    @staticmethod
    def extract_display_id(subject: str, body: str) -> Optional[str]:
        """
        Extract the first matching ticket display ID from subject or body text.
        """
        # 1. Search subject first (most reliable)
        match = REF_PATTERN.search(subject)
        if match:
            return match.group(0).upper()

        # 2. Search body text as fallback
        match = REF_PATTERN.search(body)
        if match:
            return match.group(0).upper()

        return None

    @staticmethod
    def match_thread(
        db: Session,
        subject: str,
        body: str,
        in_reply_to: Optional[str] = None,
        references: Optional[str] = None,
    ) -> Optional[WorkItem]:
        """
        Match an inbound email to an existing WorkItem.
        Returns the matched WorkItem or None if it's a new ticket candidate.
        """
        # Strategy 1: Match by direct display_id reference in subject or body
        display_id = EmailThreadMatcher.extract_display_id(subject, body)
        if display_id:
            work_item = (
                db.query(WorkItem)
                .filter(WorkItem.display_id == display_id)
                .first()
            )
            if work_item:
                return work_item

        # Strategy 2: Match by threading headers (In-Reply-To / References)
        message_ids = []
        if in_reply_to:
            message_ids.append(in_reply_to.strip())
        if references:
            # References header can contain multiple space-separated Message-IDs
            for ref in references.split():
                clean_ref = ref.strip()
                if clean_ref:
                    message_ids.append(clean_ref)

        if message_ids:
            # Query email_messages to see if we have processed any of these message_ids
            matched_msg = (
                db.query(EmailMessage)
                .filter(
                    EmailMessage.message_id.in_(message_ids),
                    EmailMessage.work_item_id.isnot(None),
                )
                .first()
            )
            if matched_msg:
                work_item = (
                    db.query(WorkItem)
                    .filter(WorkItem.id == matched_msg.work_item_id)
                    .first()
                )
                if work_item:
                    return work_item

        return None
