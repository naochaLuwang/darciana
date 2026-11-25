export type AppleSignInProps = {
  next: string;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
};

// Native Apple authorization is supplied by the mobile build's module alias.
export function AppleSignIn(props: AppleSignInProps) {
  void props;
  return null;
}
