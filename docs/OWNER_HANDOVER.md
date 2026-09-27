# Owner Handover Guide

This guide lets the organization owner use Cheliv without needing a software developer for normal account management.

## Install Cheliv like an app

The website can be installed from its real HTTPS address. It is the same secure website in an app-style window, not a separate copy of patient information.

| Device | Simple steps |
| --- | --- |
| iPhone or iPad | Open Cheliv in Safari. Tap Share, then **Add to Home Screen**, then **Add**. |
| Android | Open Cheliv in Chrome. Tap the browser menu, then **Install app** or **Add to Home screen**. |
| Windows | Open Cheliv in Chrome or Edge. Use the browser menu, then **Install Cheliv**. It can be pinned to Start or the taskbar afterward. |
| Mac | Open Cheliv in Chrome, Edge, or Safari. Use the browser install or Add to Dock option when offered. |
| Chromebook | Open Cheliv in Chrome and choose **Install** from the browser menu. |

If the installation option does not appear, refresh after deployment, confirm the address begins with `https://`, then check the browser menu. The normal website still works without installation.

## Change your own name, email, or password

1. Sign in.
2. Open the menu on a phone, or the left sidebar on a computer.
3. Choose **My account**.
4. To update your name or email, enter the new details and your current password, then choose **Save profile**.
5. To change your password, enter your current password, a new password, and the confirmation, then choose **Change password**.

Changing a password signs out other devices using that account. This is intentional protection if a phone or laptop is lost.

## Give the owner Super Admin access

Do this only when the owner already has an Administrator account.

1. The current Super Admin signs in and opens **My account**.
2. In **Transfer Super Admin**, choose the owner's existing Administrator account.
3. Enter the current Super Admin password and choose **Transfer Super Admin**.
4. The new owner signs in and verifies that their role says Super Admin.

The previous Super Admin stays an Administrator. Do not share a password or use a personal account for a new owner. Create a named account first through **Staff**.

## Normal office management

- **Staff**: create staff, patient, or family accounts. Give temporary passwords directly, not in unencrypted email.
- **My account**: change only your own profile and password.
- **Sign-in security**: set up an authenticator app for a staff account.
- **Active sessions**: sign out other devices if a device is lost.
- **Audit log**: review significant system events. It does not show message content.

## Before real patient information

This handover guide does not replace the production safety gate. Complete `docs/PRODUCTION_COMPLIANCE_GATE.md` and its backup, incident-response, scanning, retention, and legal review requirements first.

