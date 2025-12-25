import classNames from 'classnames';
import { getNicknameInitial } from '../utils/collaborationProfile';
import './Avatar.css';

interface AvatarProps {
  src?: string;
  label: string;
  size?: number;
  className?: string;
}

const Avatar = ({ src, label, size = 32, className }: AvatarProps) => {
  const initial = getNicknameInitial(label);
  return (
    <div
      className={classNames('avatar', className, { 'avatar--image': Boolean(src) })}
      style={{ width: size, height: size }}
      title={label}
    >
      {src ? <img src={src} alt={label} /> : <span>{initial}</span>}
    </div>
  );
};

export default Avatar;
