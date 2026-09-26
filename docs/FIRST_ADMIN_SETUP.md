# First online administrator

An empty hosted database must not have an open public “sign up as owner”
button. Before creating the first account, add a one-time private setup code
to Vercel. The screen works only while there are zero user accounts and closes
immediately after the first successful setup.

## One simple Vercel setup

1. Open the Cheliv project in Vercel.
2. Click **Settings**, then **Environment Variables**, then **Add New**.
3. For the name, enter `INITIAL_ADMIN_SETUP_TOKEN`.
4. For the value, make up a long private phrase (at least 32 characters), for
   example a sentence only you know. Do not paste it into chat or GitHub.
5. Select **Production**, **Preview**, and **Development**, then click **Save**.
6. Redeploy from the **Deployments** screen.
7. Open `https://compassionate-care-plus.vercel.app/initial-setup`.
8. Enter your name, email, new password, and the same private setup code.
9. Press **Create administrator account**. You will be signed in immediately.
10. Return to Vercel and delete `INITIAL_ADMIN_SETUP_TOKEN`. This is optional
    because the setup route closes after the first account, but removing it is
    the cleanest final step.

The setup code never appears in logs, notifications, the database, or Git.
