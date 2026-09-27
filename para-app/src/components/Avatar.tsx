type AvatarProps = {
  initials: string;
  small?: boolean;
};

export function Avatar({ initials, small = false }: AvatarProps) {
  return <div className={`avatar ${small ? "avatar--small" : ""}`}>{initials}</div>;
}
