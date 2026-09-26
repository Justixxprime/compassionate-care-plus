# Secure messaging read state

Each person who may open a patient conversation has one read-state row for
that conversation. The row holds only the time they last opened it. It does
not copy a message, sender name, or patient information.

The staff inbox counts a message as new only when somebody else sent it after
the viewer's last-opened time. Opening the conversation updates that marker.
The existing permission, organization, patient relationship, and ownership
checks run before the marker can be read or changed.

Only a recipient who has `messages.read` gets a message notification. For
example, a caregiver may be actively assigned to the case but is deliberately
not notified because their role cannot open the conversation.

Family accounts remain excluded. A family consent for visits, care team, or a
care plan does not grant access to messages.

Message notifications open the exact patient conversation. The notification
itself still contains only the generic secure-message wording. The thread URL
contains an opaque identifier, and the message service checks access again
before any conversation is returned.

The `message_read_states` migration is already part of this project. No new
migration is required for the read-state rules.
