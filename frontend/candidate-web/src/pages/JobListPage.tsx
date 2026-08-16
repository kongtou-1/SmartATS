import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/client';
import type { Job, JobCategory, JobType } from '../types';
import { JOB_TYPE_LABELS } from '../types';

const JOB_TYPE_ORDER: JobType[] = ['SOCIAL', 'CAMPUS', 'INTERN'];

interface FilterGroupProps {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function FilterGroup({ title, options, selected, onChange }: FilterGroupProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="filter-group">
      <h4 className="filter-group-title">{title}</h4>
      <ul className="filter-options">
        {options.map((opt) => (
          <li key={opt.value}>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span className="filter-checkmark" />
              <span className="filter-label">{opt.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JobListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listJobCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    api
      .listJobLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: {
      search?: string;
      job_types?: string[];
      category_codes?: string[];
      locations?: string[];
    } = {};
    if (search.trim()) params.search = search.trim();
    if (selectedJobTypes.length) params.job_types = selectedJobTypes;
    if (selectedCategories.length) params.category_codes = selectedCategories;
    if (selectedLocations.length) params.locations = selectedLocations;
    api
      .listJobs(Object.keys(params).length ? params : undefined)
      .then(setJobs)
      .finally(() => setLoading(false));
  }, [search, selectedJobTypes, selectedCategories, selectedLocations]);

  const activeFiltersCount =
    selectedJobTypes.length + selectedCategories.length + selectedLocations.length;

  const hasFilters = activeFiltersCount > 0;

  const clearFilters = () => {
    setSelectedJobTypes([]);
    setSelectedCategories([]);
    setSelectedLocations([]);
  };

  const jobTypeOptions = useMemo(
    () =>
      JOB_TYPE_ORDER.map((t) => ({
        value: t,
        label: JOB_TYPE_LABELS[t],
      })),
    [],
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.code,
        label: c.name,
      })),
    [categories],
  );

  const locationOptions = useMemo(
    () =>
      locations.map((l) => ({
        value: l,
        label: l,
      })),
    [locations],
  );

  return (
    <div className="page job-list-page">
      <section className="search-area job-list-search">
        <div className="searchbar">
          <input
            placeholder="输入城市或岗位关键字"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="si">⌕</span>
        </div>
      </section>

      <div className="job-list-layout">
        <aside className="filter-sidebar">
          <div className="filter-sidebar-head">
            <h3>筛选</h3>
            {hasFilters && (
              <button className="btn-link filter-clear" onClick={clearFilters}>
                清除
              </button>
            )}
          </div>

          <FilterGroup
            title="招聘项目"
            options={jobTypeOptions}
            selected={selectedJobTypes}
            onChange={setSelectedJobTypes}
          />

          <FilterGroup
            title="职位类别"
            options={categoryOptions}
            selected={selectedCategories}
            onChange={setSelectedCategories}
          />

          <FilterGroup
            title="工作地点"
            options={locationOptions}
            selected={selectedLocations}
            onChange={setSelectedLocations}
          />
        </aside>

        <main className="job-results">
          <div className="results-head">
            <h2>开启新的工作</h2>
            <span className="results-count">（{jobs.length}）</span>
          </div>

          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
              加载中…
            </div>
          ) : jobs.length === 0 ? (
            <div className="empty">没有匹配的岗位，换个筛选条件试试。</div>
          ) : (
            <ul className="job-list">
              {jobs.map((j) => (
                <li key={j.id} className="job-row">
                  <a
                    href={`/jobs/${j.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="job-link"
                  >
                    <h3 className="job-title">{j.title}</h3>
                    <div className="job-meta">
                      {j.location}
                      <span className="divider">|</span>
                      {JOB_TYPE_LABELS[j.job_type]}
                      {j.category_name && (
                        <>
                          <span className="divider">|</span>
                          {j.category_name}
                        </>
                      )}
                      <span className="divider">|</span>
                      职位ID：{j.id.slice(0, 8).toUpperCase()}
                    </div>
                    <p className="job-desc clamp2">{j.description}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
