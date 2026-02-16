
# CareConnect — Multi-Portal Healthcare Web App

## Overview
A multi-hospital healthcare platform with three role-based portals (Patient, Doctor, Hospital Admin) enabling the core flow: **Patient books → Doctor consults → Admin bills → Record stored**.

## Design & Theme
- Professional healthcare aesthetic: white background, blue primary (#2563EB), light green accents (#10B981)
- Clean card-based dashboards with clear navigation
- Mobile-responsive layout throughout
- Simple sidebar/top navigation per role

---

## Phase 1: Authentication & Role System

### Login & Signup
- **Patients**: Email OTP-based login (passwordless)
- **Doctors & Admins**: Email + password login
- Role selection during signup (Patient, Doctor, Admin)
- Role-based redirect to appropriate dashboard after login

### Database Foundation (Supabase)
- `user_roles` table (separate from profiles, linked to auth.users)
- `profiles` table (name, phone, avatar)
- `hospitals` table (name, address, contact info)
- `doctors` table (user_id, hospital_id, specialty, availability slots)
- `patients` table (user_id, blood group, allergies, gender, age)
- `appointments` table (patient, doctor, hospital, date/time, status)
- `consultations` table (appointment_id, observations, created_at)
- `prescriptions` table (consultation_id, medicine name, dosage, duration)
- `invoices` table (appointment_id, charges, total, status, PDF URL)
- Row-level security: patients see own data, doctors see assigned patients, admins manage their hospital

---

## Phase 2: Patient Portal

### Dashboard
- Upcoming appointments cards
- Past visits summary
- Active prescriptions list
- Recent invoices with status

### Appointment Booking
- Step-by-step flow: Select hospital → Select doctor (filtered by specialty) → Pick date & available time slot → Confirm booking
- Booking confirmation with details summary

### Medical History
- Timeline view of past consultations
- View prescriptions per consultation
- Download reports/invoices as PDF

### Profile
- Edit name, age, gender, phone
- Medical info: blood group, allergies
- Consent checkbox for medical record storage

---

## Phase 3: Doctor Portal

### Dashboard
- Today's appointments list with patient names
- Patient queue view (waiting, in-progress, completed)

### Consultation Page
- View patient details and medical history (read-only)
- Text area for observations/notes
- Prescription entry: add multiple medicines with name, dosage, duration
- Submit consultation button (marks appointment as completed)

### Patient Records
- Search and view assigned patients' past history (read-only)

---

## Phase 4: Hospital Admin Portal

### Admin Dashboard
- Stats cards: total appointments, doctors, patients
- Today's appointments overview

### Doctor Management
- Add, edit, delete doctors (creates doctor account)
- Assign specialties
- Set availability slots (day/time configuration)

### Appointment Management
- View all hospital appointments
- Approve pending bookings
- Reschedule or cancel appointments

### Billing & Invoicing
- Create invoice linked to an appointment
- Add line-item charges
- Auto-calculate total
- Generate PDF invoice (via edge function)
- Email invoice to patient (via edge function)

---

## Phase 5: PDF Generation & Email

- Edge function for PDF invoice generation (using a PDF library)
- Edge function for emailing invoices to patients
- Downloadable PDF reports for medical history
