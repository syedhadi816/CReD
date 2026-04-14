import './markdown-math.css';

type TrustedMathHtmlProps = {
  html?: string | null;
  fallbackText?: string;
  className?: string;
  variant?: 'default' | 'compact';
};

/**
 * Renders pre-generated trusted HTML from backend seed/administer pipeline.
 * This avoids runtime markdown/math parsing drift in the client.
 */
export function TrustedMathHtml({ html, fallbackText, className, variant = 'default' }: TrustedMathHtmlProps) {
  if (!html || !html.trim()) {
    return <div className={className}>{fallbackText ?? ''}</div>;
  }

  return (
    <div
      className={['cred-markdown-math', className].filter(Boolean).join(' ')}
      style={{ lineHeight: variant === 'compact' ? 1.45 : 1.6 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
