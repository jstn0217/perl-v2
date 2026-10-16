import { useLayoutEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SchoolMark } from '../components/SchoolMark';
import { fetchPublicIntake, submitPublicEnrollment, submitPublicInquiry } from '../lib/api';
import { useSchoolTheme } from '../providers/SchoolThemeContext';
import type { IntakeInfo } from '../types/submission';

type IntakeLoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; intake: IntakeInfo };

type FormTab = 'enrollment' | 'inquiry';

interface AddressFormState {
  addressLine1: string;
  addressLine2: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
}

interface EnrollmentFormState extends AddressFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gradeLevelApplying: string;
  guardianName: string;
  message: string;
  website: string;
}

interface InquiryFormState extends AddressFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
}

const emptyAddressForm: AddressFormState = {
  addressLine1: '',
  addressLine2: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: ''
};

const emptyEnrollmentForm: EnrollmentFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  ...emptyAddressForm,
  gradeLevelApplying: '',
  guardianName: '',
  message: '',
  website: ''
};

const emptyInquiryForm: InquiryFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  ...emptyAddressForm,
  message: '',
  website: ''
};

const normalize = (value: string) => (value.trim().length > 0 ? value.trim() : null);

const applyThemeVariables = (theme: IntakeInfo['school']['theme']) => {
  const root = document.documentElement;
  root.style.setProperty('--school-primary', theme.primaryColor);
  root.style.setProperty('--school-secondary', theme.secondaryColor);
  root.style.setProperty('--school-accent', theme.accentColor);
};

const HoneypotField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div className="apply-honeypot" aria-hidden="true">
    <label htmlFor="website">Leave this field empty</label>
    <input
      id="website"
      name="website"
      type="text"
      tabIndex={-1}
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

const EnrollmentForm = ({ slug }: { slug: string }) => {
  const [form, setForm] = useState<EnrollmentFormState>(emptyEnrollmentForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicEnrollment(slug, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: normalize(form.phone) ?? undefined,
        gradeLevelApplying: normalize(form.gradeLevelApplying) ?? undefined,
        guardianName: normalize(form.guardianName) ?? undefined,
        message: normalize(form.message) ?? undefined,
        addressLine1: normalize(form.addressLine1) ?? undefined,
        addressLine2: normalize(form.addressLine2) ?? undefined,
        barangay: normalize(form.barangay) ?? undefined,
        city: normalize(form.city) ?? undefined,
        province: normalize(form.province) ?? undefined,
        zipCode: normalize(form.zipCode) ?? undefined,
        website: form.website
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="apply-confirmation" role="status">
        <h2>Application received</h2>
        <p>Thank you, {form.firstName}. The school will review your application and reach out at {form.email}.</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setForm(emptyEnrollmentForm);
            setSubmitted(false);
          }}
        >
          Submit another application
        </button>
      </div>
    );
  }

  return (
    <form className="admin-form apply-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <label className="field">
          <span>First name</span>
          <input
            type="text"
            value={form.firstName}
            onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            required
            autoComplete="given-name"
          />
        </label>
        <label className="field">
          <span>Last name</span>
          <input
            type="text"
            value={form.lastName}
            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            required
            autoComplete="family-name"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Email address</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            autoComplete="tel"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Address line 1 (optional)</span>
          <input
            type="text"
            value={form.addressLine1}
            onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))}
            autoComplete="address-line1"
          />
        </label>
        <label className="field">
          <span>Address line 2 (optional)</span>
          <input
            type="text"
            value={form.addressLine2}
            onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))}
            autoComplete="address-line2"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Barangay (optional)</span>
          <input
            type="text"
            value={form.barangay}
            onChange={(event) => setForm((current) => ({ ...current, barangay: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>City (optional)</span>
          <input
            type="text"
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            autoComplete="address-level2"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Province (optional)</span>
          <input
            type="text"
            value={form.province}
            onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))}
            autoComplete="address-level1"
          />
        </label>
        <label className="field">
          <span>ZIP code (optional)</span>
          <input
            type="text"
            value={form.zipCode}
            onChange={(event) => setForm((current) => ({ ...current, zipCode: event.target.value }))}
            autoComplete="postal-code"
            inputMode="numeric"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Grade level applying for</span>
          <input
            type="text"
            value={form.gradeLevelApplying}
            onChange={(event) => setForm((current) => ({ ...current, gradeLevelApplying: event.target.value }))}
            placeholder="e.g. Grade 7"
            required
          />
        </label>
        <label className="field">
          <span>Guardian name (optional)</span>
          <input
            type="text"
            value={form.guardianName}
            onChange={(event) => setForm((current) => ({ ...current, guardianName: event.target.value }))}
          />
        </label>
      </div>

      <label className="field">
        <span>Anything else you&rsquo;d like the school to know (optional)</span>
        <textarea
          rows={3}
          value={form.message}
          onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
        />
      </label>

      <HoneypotField value={form.website} onChange={(website) => setForm((current) => ({ ...current, website }))} />

      {error ? (
        <div className="form-message form-message--error" role="alert">{error}</div>
      ) : null}

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </form>
  );
};

const InquiryForm = ({ slug }: { slug: string }) => {
  const [form, setForm] = useState<InquiryFormState>(emptyInquiryForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicInquiry(slug, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: normalize(form.phone) ?? undefined,
        message: form.message.trim(),
        addressLine1: normalize(form.addressLine1) ?? undefined,
        addressLine2: normalize(form.addressLine2) ?? undefined,
        barangay: normalize(form.barangay) ?? undefined,
        city: normalize(form.city) ?? undefined,
        province: normalize(form.province) ?? undefined,
        zipCode: normalize(form.zipCode) ?? undefined,
        website: form.website
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send your inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="apply-confirmation" role="status">
        <h2>Inquiry sent</h2>
        <p>Thank you, {form.firstName}. The school will get back to you at {form.email}.</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setForm(emptyInquiryForm);
            setSubmitted(false);
          }}
        >
          Send another inquiry
        </button>
      </div>
    );
  }

  return (
    <form className="admin-form apply-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <label className="field">
          <span>First name</span>
          <input
            type="text"
            value={form.firstName}
            onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            required
            autoComplete="given-name"
          />
        </label>
        <label className="field">
          <span>Last name</span>
          <input
            type="text"
            value={form.lastName}
            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            required
            autoComplete="family-name"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Email address</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            autoComplete="tel"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Address line 1 (optional)</span>
          <input
            type="text"
            value={form.addressLine1}
            onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))}
            autoComplete="address-line1"
          />
        </label>
        <label className="field">
          <span>Address line 2 (optional)</span>
          <input
            type="text"
            value={form.addressLine2}
            onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))}
            autoComplete="address-line2"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Barangay (optional)</span>
          <input
            type="text"
            value={form.barangay}
            onChange={(event) => setForm((current) => ({ ...current, barangay: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>City (optional)</span>
          <input
            type="text"
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            autoComplete="address-level2"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Province (optional)</span>
          <input
            type="text"
            value={form.province}
            onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))}
            autoComplete="address-level1"
          />
        </label>
        <label className="field">
          <span>ZIP code (optional)</span>
          <input
            type="text"
            value={form.zipCode}
            onChange={(event) => setForm((current) => ({ ...current, zipCode: event.target.value }))}
            autoComplete="postal-code"
            inputMode="numeric"
          />
        </label>
      </div>

      <label className="field">
        <span>Your message</span>
        <textarea
          rows={4}
          value={form.message}
          onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
          required
        />
      </label>

      <HoneypotField value={form.website} onChange={(website) => setForm((current) => ({ ...current, website }))} />

      {error ? (
        <div className="form-message form-message--error" role="alert">{error}</div>
      ) : null}

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send inquiry'}
        </button>
      </div>
    </form>
  );
};

export const ApplyPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const outerTheme = useSchoolTheme();
  const [loadState, setLoadState] = useState<IntakeLoadState>(
    slug ? { status: 'loading' } : { status: 'not-found' }
  );
  const [activeTab, setActiveTab] = useState<FormTab>('enrollment');

  useLayoutEffect(() => {
    if (!slug) return;

    let cancelled = false;

    void fetchPublicIntake(slug)
      .then((intake) => {
        if (cancelled) return;
        setLoadState({ status: 'ready', intake });
        setActiveTab(intake.enrollmentEnabled ? 'enrollment' : 'inquiry');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unable to load this page.';
        setLoadState(message.includes('could not be found') ? { status: 'not-found' } : { status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useLayoutEffect(() => {
    if (loadState.status !== 'ready') return;
    applyThemeVariables(loadState.intake.school.theme);

    return () => {
      applyThemeVariables(outerTheme.school.theme);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState]);

  if (loadState.status === 'loading') {
    return (
      <main className="apply-page apply-page--centered">
        <p className="panel-label">Loading…</p>
      </main>
    );
  }

  if (loadState.status === 'not-found') {
    return (
      <main className="apply-page apply-page--centered">
        <div className="empty-state">
          <h1>School not found</h1>
          <p>This application link is not valid. Check the link you were given, or contact the school directly.</p>
          <Link className="secondary-button secondary-button--link" to="/">Return home</Link>
        </div>
      </main>
    );
  }

  if (loadState.status === 'error') {
    return (
      <main className="apply-page apply-page--centered">
        <div className="empty-state empty-state--error" role="alert">
          <h1>Something went wrong</h1>
          <p>{loadState.message}</p>
        </div>
      </main>
    );
  }

  const { intake } = loadState;
  const { school, enrollmentEnabled, inquiryEnabled } = intake;
  const bothEnabled = enrollmentEnabled && inquiryEnabled;

  return (
    <main className="apply-page">
      <header className="apply-page__header">
        <div className="brand-lockup">
          <SchoolMark name={school.name} logoUrl={school.logoUrl} />
          <div>
            <p className="eyebrow">{school.name}</p>
            <h1>{enrollmentEnabled && inquiryEnabled ? 'Apply or get in touch' : enrollmentEnabled ? 'Apply for enrollment' : 'Get in touch'}</h1>
          </div>
        </div>
      </header>

      {!enrollmentEnabled && !inquiryEnabled ? (
        <div className="empty-state">
          <h2>Forms are currently closed</h2>
          <p>{school.name} is not accepting online applications or inquiries at this time. Please contact the school directly.</p>
        </div>
      ) : (
        <section className="apply-page__card">
          {bothEnabled ? (
            <div className="apply-tabs" role="tablist" aria-label="Choose a form">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'enrollment'}
                className={activeTab === 'enrollment' ? 'apply-tab apply-tab--active' : 'apply-tab'}
                onClick={() => setActiveTab('enrollment')}
              >
                Enrollment application
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'inquiry'}
                className={activeTab === 'inquiry' ? 'apply-tab apply-tab--active' : 'apply-tab'}
                onClick={() => setActiveTab('inquiry')}
              >
                General inquiry
              </button>
            </div>
          ) : (
            <h2>{enrollmentEnabled ? 'Enrollment application' : 'General inquiry'}</h2>
          )}

          {activeTab === 'enrollment' && enrollmentEnabled ? <EnrollmentForm slug={slug ?? ''} /> : null}
          {activeTab === 'inquiry' && inquiryEnabled ? <InquiryForm slug={slug ?? ''} /> : null}
        </section>
      )}

      <footer className="app-footer">
        <img src="/brand/perl-mark-96.png" alt="" width="20" height="17" aria-hidden="true" />
        <span>Powered by AMoS</span>
      </footer>
    </main>
  );
};
