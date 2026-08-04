import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const LABEL_CLASS = 'text-xs font-medium text-gray-700';
const CONTROL_CLASS =
  'rounded border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * A labeled text/number/date input, with the label/error correctly
 * associated for screen readers.
 * @param props standard input attributes plus `label`/`error`
 * @param props.label the visible field label
 * @param props.error a validation message, rendered below the input and linked via `aria-describedby`
 * @param props.id an explicit input id — auto-generated via `useId` if omitted
 * @param props.className extra classes merged onto the base style
 * @returns the labeled field element
 */
export function Field({ label, error, id, className = '', ...props }: FieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={fieldId}
        className={`${CONTROL_CLASS} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: ReactNode;
}

/**
 * A labeled `<select>`, styled to match {@link Field}.
 * @param props standard select attributes plus `label`/`error`
 * @param props.label the visible field label
 * @param props.error a validation message, rendered below the select
 * @param props.id an explicit select id — auto-generated via `useId` if omitted
 * @param props.className extra classes merged onto the base style
 * @param props.children the `<option>` elements
 * @returns the labeled select element
 */
export function SelectField({
  label,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className={LABEL_CLASS}>
        {label}
      </label>
      <select
        id={fieldId}
        className={`${CONTROL_CLASS} bg-white ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

/**
 * A labeled `<textarea>`, styled to match {@link Field}.
 * @param props standard textarea attributes plus `label`/`error`
 * @param props.label the visible field label
 * @param props.error a validation message, rendered below the textarea
 * @param props.id an explicit textarea id — auto-generated via `useId` if omitted
 * @param props.className extra classes merged onto the base style
 * @returns the labeled textarea element
 */
export function TextareaField({
  label,
  error,
  id,
  className = '',
  ...props
}: TextareaFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className={LABEL_CLASS}>
        {label}
      </label>
      <textarea
        id={fieldId}
        className={`${CONTROL_CLASS} ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
