import React, { useEffect, useRef, useState } from 'react';
import type { Message } from '../../types';

interface Props {
  message: Message;
  onAvatarClick?: (senderName: string) => void;
}

const MessageBubble: React.FC<Props> = ({ message, onAvatarClick }) => {
  const [displayText, setDisplayText] = useState(message.self ? message.text : '');
  const animating = useRef(false);
  const prevTextRef = useRef(message.text);

  useEffect(() => {
    if (message.self) {
      setDisplayText(message.text);
      return;
    }

    // For streaming/typing messages, just display text directly (tokens arrive incrementally)
    if (message.typing) {
      setDisplayText(message.text || '\u2588');
      return;
    }

    // If text is being updated incrementally (streaming complete replacement), show directly
    if (prevTextRef.current !== '' && message.text.startsWith(prevTextRef.current)) {
      setDisplayText(message.text);
      prevTextRef.current = message.text;
      return;
    }

    prevTextRef.current = message.text;

    // Typewriter effect for static agent messages
    if (animating.current) {
      // If already animating, just update target
      setDisplayText(message.text);
      animating.current = false;
      return;
    }
    animating.current = true;
    let idx = 0;
    const text = message.text;
    const interval = setInterval(() => {
      idx++;
      setDisplayText(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(interval);
        animating.current = false;
      }
    }, 15 + Math.random() * 20);
    return () => { clearInterval(interval); animating.current = false; };
  }, [message.text, message.self, message.typing]);

  if (message.self) {
    return (
      <div className="msg msg-self">
        <div className="msg-body">
          <span className="msg-name">{'\u6211'}</span>
          <div className="msg-bubble">{message.text}</div>
          <span className="msg-time">{message.time}</span>
        </div>
        <div
          className="msg-avatar"
          style={{ background: 'linear-gradient(135deg,#3370ff,#6b5ce7)' }}
        >
          {'\u6211'}
        </div>
      </div>
    );
  }

  return (
    <div className="msg">
      <div
        className="msg-avatar"
        style={{ background: message.color || '#3370ff', cursor: 'pointer' }}
        onClick={() => onAvatarClick?.(message.sender)}
      >
        {(message.sender || '?').charAt(0)}
      </div>
      <div className="msg-body">
        <span
          className="msg-name"
          style={{ cursor: 'pointer' }}
          onClick={() => onAvatarClick?.(message.sender)}
        >
          {message.sender}
        </span>
        <div className="msg-bubble" style={{ whiteSpace: 'pre-wrap' }}>
          {displayText || (message.typing ? '\u2588' : '')}
        </div>
        <span className="msg-time">{message.time}</span>
      </div>
    </div>
  );
};

export default MessageBubble;
