import { useEffect } from 'react';
import CustomSelect from '../../ui/CustomSelect';
import { useWorkflowStore } from '../../../stores/workflow-store';

interface WorkflowPickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  currentWorkflowId?: string;
}

export default function WorkflowPickerField({ label, value, onChange, required, currentWorkflowId }: WorkflowPickerFieldProps) {
  const { workflows, fetchWorkflows } = useWorkflowStore();

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const options = workflows
    .filter(w => w.id !== currentWorkflowId)
    .map(w => ({ label: w.name, value: w.id }));

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
        placeholder="选择工作流..."
      />
    </div>
  );
}
