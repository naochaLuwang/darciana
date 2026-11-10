'use client';
import {
  cloneElement,
  useId,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
  type ComponentProps,
} from 'react';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function useAdminReady() {
  return useSyncExternalStore(subscribe, clientReady, serverReady);
}
export function FormReady({
  children,
  disabled = false,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const ready = useAdminReady();
  return (
    <fieldset disabled={disabled || !ready} className={className ?? 'min-w-0 space-y-5'}>
      {children}
    </fieldset>
  );
}
export function AdminField({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
}) {
  const id = useId();
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {cloneElement(children, {
        id,
        'aria-describedby': description ? `${id}-hint` : children.props['aria-describedby'],
      })}
      {description ? <FieldDescription id={`${id}-hint`}>{description}</FieldDescription> : null}
    </Field>
  );
}
export function AdminCheck({
  label,
  ...props
}: ComponentProps<typeof Checkbox> & { label: ReactNode }) {
  const generated = useId();
  const ready = useAdminReady();
  const id = props.id ?? generated;
  return (
    <Field orientation="horizontal" className="min-h-10 gap-3">
      <Checkbox {...props} id={id} disabled={props.disabled || !ready} />
      <FieldLabel htmlFor={id} className="leading-relaxed">
        {label}
      </FieldLabel>
    </Field>
  );
}
export function AdminSwitch({
  label,
  description,
  ...props
}: ComponentProps<typeof Switch> & { label: ReactNode; description?: ReactNode }) {
  const generated = useId();
  const ready = useAdminReady();
  const id = props.id ?? generated;
  return (
    <Field orientation="horizontal" className="justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </div>
      <Switch {...props} id={id} disabled={props.disabled || !ready} />
    </Field>
  );
}
export function AdminSelect({
  value,
  onValueChange,
  options,
  name,
  placeholder,
  ...props
}: Omit<ComponentProps<typeof SelectTrigger>, 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  const ready = useAdminReady();
  return (
    <Select
      name={name}
      value={value || '__empty__'}
      onValueChange={(next) => onValueChange(next === '__empty__' ? '' : next)}
      disabled={props.disabled || !ready}
    >
      <SelectTrigger {...props} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value || '__empty__'}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
