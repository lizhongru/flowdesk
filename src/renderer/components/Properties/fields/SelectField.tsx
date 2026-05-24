import CustomSelect from '../../ui/CustomSelect';

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  required?: boolean;
}

export default function SelectField({ label, value, onChange, options, required }: SelectFieldProps) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--error)' }}> *</span>}
      </label>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
      />
    </div>
  );
}
