# BMI Stellar Brand Guidelines

This document defines the visual identity and communication standards for the BMI Stellar project. It ensures consistent branding across all touchpoints — from the GitHub repository to the application UI and documentation.

---

## 1. Brand Identity

**BMI Stellar** is a serious, privacy-first health metrics application built for local-first measurement and long-term tracking. The brand reflects:

- **Privacy** — local-first data, encrypted backups, zero-knowledge architecture
- **Precision** — accurate calculations (BMI, TDEE, body-fat), strict unit handling
- **Accessibility** — keyboard-visible focus, ARIA patterns, multilingual support
- **Premium Utility** — professional identity, dark-mode first, cinematic but functional UI

The brand sits at the intersection of **health technology** and **personal privacy**.

---

## 2. Name Usage

### 2.1. Correct forms

| Context                          | Format            |
| -------------------------------- | ----------------- |
| Running text / prose             | BMI Stellar       |
| Titles / headings                | BMI Stellar       |
| Code / Repo                      | `bmi` (lowercase) |
| All-caps hero (README hero only) | BMI STELLAR       |

### 2.2. Incorrect forms

- ~~Bmi Stellar~~ (BMI should be all-caps)
- ~~BMIstellar~~ (no space)
- ~~Stellar BMI~~ (wrong order)
- ~~B.M.I. Stellar~~ (no periods)

---

## 3. Logo

### 3.1. Logo file

The official logo is located at [`static/assets/new_bmi_logo_2026.webp`](static/assets/new_bmi_logo_2026.webp).

### 3.2. Usage rules

- **Clear space**: maintain padding equal to at least 20% of the logo height on all sides
- **Background**: designed for dark backgrounds (`#0F172A`); avoid placing on light-colored surfaces without a dark container
- **Aspect ratio**: always preserve the original aspect ratio — do not stretch or distort

---

## 4. Color Palette

The BMI Stellar palette is a professional, dark-themed system with vibrant accents.

### 4.1. Primary colors

| Role           | Color     | Hex       | Usage                   |
| -------------- | --------- | --------- | ----------------------- |
| Background     | Slate 950 | `#020617` | Main app background     |
| Surface        | Slate 900 | `#0F172A` | Cards, modals, sections |
| Text Primary   | White     | `#FFFFFF` | Headings, primary text  |
| Text Secondary | Slate 400 | `#94A3B8` | Subtext, labels         |

### 4.2. Accent colors

| Role             | Color      | Hex       | Usage                              |
| ---------------- | ---------- | --------- | ---------------------------------- |
| Primary Accent   | Indigo 600 | `#4F46E5` | Buttons, links, primary highlights |
| Secondary Accent | Violet 600 | `#7C3AED` | Secondary highlights, gauges       |

---

## 5. Typography

### 5.1. Primary fonts

- **Body/Headings**: `Inter` (Variable)
- **Data/Code**: `JetBrains Mono` (Variable)

---

## 6. Tone of Voice

BMI Stellar's communication should be technically precise, respectful of privacy, and professional.

- **Direct and technical** — describe metrics accurately.
- **Privacy-focused** — emphasize local-first and encryption.
- **Helpful, not medical** — provide guidance while maintaining the boundary of a software tool, not a doctor.

---

## 7. Third-party Usage

External projects or articles referencing BMI Stellar should:

- Use the correct project name: BMI Stellar
- Link to the official repository: <https://github.com/oxyzenQ/bmi>
- Use the official logo without modification
