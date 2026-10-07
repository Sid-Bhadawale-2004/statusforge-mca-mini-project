# Claude Prompt: Prepare StatusForge Mini-Project Documentation as a Word Document

Copy the prompt below into Claude Code. If Claude Code is working locally, open the StatusForge project folder. If using a GitHub-connected Claude session, provide the repository URL and ask Claude to inspect the project. Attach the institute certificate and any actual application screenshots if they are available.

---

You are preparing the formal project documentation for the **S.Y. MCA Semester III, ITP31 Mini Project (Research Project)** titled **StatusForge**.

**Project repository:** <https://github.com/Sid-Bhadawale-2004/statusforge-mca-mini-project>

First inspect the complete project repository at the URL above (or the locally opened StatusForge repository), including the backend, frontend, database models, API routes, tests, seed data, and existing README. Use the accompanying project-guidelines image as the required outline. If the repository is private or inaccessible to you, stop and report that access is required; do not pretend to have inspected it.

## Deliverable

Create a polished, submission-ready **Microsoft Word document** named `PROJECT_DOCUMENTATION.docx` in the repository root. This `.docx` file is the required final deliverable. Do not substitute Markdown, plain text, or a PDF for the Word document. Do not modify application source code. Describe only features and behavior that you can verify from the repository. Do not invent implementation details, test results, certificates, screenshots, or data. Mark missing student/institute details and unavailable evidence with clearly labeled placeholders for the student to complete.

Use a Word-generation library/tool available in the environment (for example, `python-docx`). Render the document with a professional title page, page numbers, consistent heading styles, readable tables, and captions. Render diagrams as images and embed them in the Word document; do not leave raw Mermaid code as the only diagram. If a required tool or evidence is unavailable, state that clearly and leave a completion placeholder rather than claiming success. Reopen or otherwise validate the generated `.docx` and ensure it is present at the requested path.

## Required document structure

1. **Title page**
   - S.Y. MCA Semester III
   - Course: ITP31 Mini Project (Research Project)
   - Project title: StatusForge
   - Placeholders for student name, roll number, institute, guide, academic year, and submission date.

2. **Institute Certificate**
   - Add a clearly marked placeholder stating that the official institute-issued certificate must be inserted here.
   - Do not draft, imitate, or claim to issue an official certificate.

3. **Chapter 1 — Introduction**
   - **1.1 Project Purpose:** Explain the problem addressed, intended users, scope, and objectives using repository evidence.
   - **1.2 Project Functions / Modules:** Describe each implemented frontend module, backend service, and major workflow. Distinguish implemented functions from any planned or unavailable features.

4. **Chapter 2 — Analysis and Design**
   - **2.1 Entity Relationship Diagram (ERD):** Provide a Mermaid ER diagram based on the actual Mongoose models and references. Identify embedded subdocuments and relationships accurately.
   - **2.2 Table Structure / Data Dictionary:** Since the project uses MongoDB rather than relational tables, document each collection and its fields, types, required/optional status, defaults, enums, references, and purpose. Use one readable table per collection.
   - **2.3 Use Case Diagrams:** Provide Mermaid use-case diagrams for the actual roles (administrator, responder, viewer, and public visitor where applicable). Include only verified interactions.
   - **2.4 Sample Input and Output Screens:** Document the real application screens, their purpose, representative valid input/output, and validation rules. Provide at least **five valid records or examples for every screen**. Use repository seed data when appropriate; otherwise create clearly labeled illustrative examples consistent with validation rules. For screens that do not display record lists, provide five valid input/output examples associated with that screen. Never claim that an illustrative example was captured from the running application. Add placeholders for actual screen captures and explain how to capture them.

5. **Chapter 3 — Testing**
   - **3.1 Test Cases / Test Scripts:** Provide a traceable test-case table with ID, feature, preconditions, steps/input, expected result, and actual result. Derive test cases from actual routes, validation schemas, and UI workflows. Label unexecuted tests as “Not run”; do not fabricate pass results.
   - **3.2 Defect Report / Test Log:** Include a defect-log template with severity, steps to reproduce, expected/actual behavior, status, and evidence. Include only defects verifiable from repository history or supplied evidence; otherwise leave sample rows clearly identified as blank templates.

6. **Chapter 4 — Publication / Competition Certificates (If Applicable)**
   - State that this section is not applicable unless the student supplies verified publication or competition evidence. Include placeholders for genuine certificates only.

7. **Chapter 5 — User Manual**
   - Cover every implemented screen. For each screen, state its purpose, access/role requirements, controls, workflow, expected result, and all relevant field/data validation rules.
   - Include setup and run instructions based on the actual package scripts and configuration examples. Do not publish secrets; refer to environment variable names only.

8. **References and Appendices**
   - Cite project files using repository-relative paths for factual implementation details.
   - Add a glossary of important StatusForge terms and an evidence checklist for the student.

## Accuracy and formatting requirements

- Use formal, clear academic English, a table of contents, consistent heading numbering, page breaks where useful, and concise tables.
- Base every diagram on repository evidence and embed a rendered, legible diagram in the Word document.
- Use the actual technology and architecture found in the project; do not assume relational SQL, unsupported integrations, or features that are not implemented.
- Describe notification delivery according to the current code and configuration; never include credentials, tokens, private URLs, or personal information from local environment files.
- Ensure that every required guideline heading is present. If repository evidence is insufficient for a section, state what evidence is missing and leave a completion placeholder rather than guessing.
- Finish with a pre-submission checklist confirming the certificate, five-record screen evidence, actual screenshots, test execution, student details, and any applicable certificates have been supplied.
