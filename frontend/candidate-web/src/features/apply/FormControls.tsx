import { Fragment, type ReactNode } from 'react';
import type { CandidateExperience } from '../../types';

/** 把必填标记 * 渲染成红色 */
export function renderLabel(label: string): ReactNode {
  const parts = label.split('*');
  return parts.map((part, i) =>
    i === parts.length - 1 ? (
      part
    ) : (
      <Fragment key={i}>
        {part}
        <span className="req">*</span>
      </Fragment>
    ),
  );
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{renderLabel(label)}</span>
      <input
        className="input"
        type={type}
        disabled={disabled}
        value={value}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Month(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return <Field {...props} type="month" />;
}

export function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{renderLabel(label)}</span>
      <textarea
        className="input area"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = '请选择',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{renderLabel(label)}</span>
      <select className="input" value={value} autoComplete="off" onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled={value !== ''}>
          {placeholder}
        </option>
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SectionHead({
  title,
  hint,
  onAdd,
}: {
  title: string;
  hint: string;
  onAdd: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      <button className="btn" onClick={onAdd}>
        + 添加
      </button>
    </div>
  );
}

export function EntryCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="entry-card">
      <div className="entry-head">
        <b>{title}</b>
        <button className="btn-link danger" onClick={onRemove}>
          删除
        </button>
      </div>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="empty compact-empty">{text}</div>;
}

export function ExperienceSection({
  title,
  rows,
  add,
  update,
  remove,
}: {
  title: string;
  rows: CandidateExperience[];
  add: () => void;
  update: (index: number, value: CandidateExperience) => void;
  remove: (index: number) => void;
}) {
  return (
    <div>
      <SectionHead title={title} hint="可添加 0 条或多条" onAdd={add} />
      {rows.length === 0 && <Empty text={`暂无${title}，可手动添加`} />}
      {rows.map((item, index) => (
        <EntryCard title={`${title} ${index + 1}`} onRemove={() => remove(index)} key={index}>
          <div className="form-stack">
            <Field
              label="单位 *"
              value={item.company}
              onChange={(value) => update(index, { ...item, company: value })}
            />
            <Field
              label={`${title === '实习经历' ? '名称' : '职位'} *`}
              value={item.title}
              onChange={(value) => update(index, { ...item, title: value })}
            />
            <div className="form-row">
              <Month
                label="开始时间 *"
                value={item.start}
                onChange={(value) => update(index, { ...item, start: value })}
              />
              <Month
                label="结束时间"
                value={item.end}
                disabled={item.current}
                onChange={(value) => update(index, { ...item, end: value })}
              />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={item.current}
                onChange={(event) =>
                  update(index, {
                    ...item,
                    current: event.target.checked,
                    end: event.target.checked ? '' : item.end,
                  })
                }
              />
              至今
            </label>
          </div>
          <Text
            label="描述 *"
            value={item.description}
            onChange={(value) => update(index, { ...item, description: value })}
          />
        </EntryCard>
      ))}
    </div>
  );
}

export function Review({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <b>{title}</b>
      <p className="pre-wrap">{text || '无'}</p>
    </div>
  );
}

export function IconField({
  label,
  value,
  onChange,
  type = 'text',
  icon,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: ReactNode;
  placeholder?: string;
}) {
  return (
    <label className="field icon-field">
      <span>{renderLabel(label)}</span>
      {icon ? (
        <div className="input-wrap">
          <span className="input-icon">{icon}</span>
          <input
            className="input with-icon"
            type={type}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : (
        <input
          className="input"
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export function RadioGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, ReactNode])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field radio-field">
      <span>{renderLabel(label)}</span>
      <div className="radio-group">
        {value === '' && (
          <input type="radio" name={label} value="" checked readOnly className="radio-hidden" />
        )}
        {options.map(([optionValue, optionLabel]) => (
          <label
            className={`radio-pill ${value === optionValue ? 'active' : ''}`}
            key={optionValue}
          >
            <input
              type="radio"
              name={label}
              value={optionValue}
              checked={value === optionValue}
              onChange={(event) => onChange(event.target.value)}
            />
            <span>{optionLabel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
