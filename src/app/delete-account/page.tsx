import Link from 'next/link';

export const metadata = {
  title: 'Delete your Daciana account',
  description: 'Request deletion of your Daciana account and associated data.',
};
const email = 'luwangtech0@gmail.com';
const request = `mailto:${email}?subject=${encodeURIComponent('Delete my Daciana account')}&body=${encodeURIComponent('Please delete my Daciana account and its associated data.\n\nAccount email: ')}`;

export default function AccountDeletionPage() {
  return (
    <main id="main" className="page-width info-page">
      <h1>Delete your Daciana account</h1>
      <article className="info-content">
        <h2>From the app</h2>
        <p>
          Open Profile, select Delete account, and confirm with your password or the same Google
          account you used to sign in.
        </p>
        <h2>Without the app</h2>
        <p>
          Email{' '}
          <a className="text-link" href={request}>
            {email}
          </a>{' '}
          from the email address linked to your account. Use the subject “Delete my Daciana account”
          and request deletion of your account and associated data. We verify ownership before
          processing the request. Do not send your password.
        </p>
        <a href={request} className="button button-dark">
          Request account deletion
        </a>
        <h2>What is deleted</h2>
        <p>
          Account deletion removes your sign-in account, profile, saved addresses, notification
          registrations and order records linked to the account from the app’s active database. The
          app clears the bag and saved items on the device where you delete your account. You can
          clear these on other devices by clearing the app’s storage.
        </p>
        <p>
          Emails, records already needed for delivery, and provider-managed security logs or backups
          may follow separate retention periods. Contact us about these records or any data you want
          removed.
        </p>
        <p>
          <Link className="text-link" href="/more/privacy-policy">
            Privacy policy
          </Link>{' '}
          ·{' '}
          <Link className="text-link" href="/account">
            Open your account
          </Link>
        </p>
      </article>
    </main>
  );
}
