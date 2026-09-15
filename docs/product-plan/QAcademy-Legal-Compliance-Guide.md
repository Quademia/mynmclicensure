
QAcademy
Legal & Compliance Guide
Prepared: March 2026
Confidential — Internal Use Only



This document covers everything needed to operate QAcademy's three products legally and compliantly in Ghana. It addresses business registration, data protection, terms of service, payment compliance, school contracts, intellectual property, and infrastructure compliance.

The three products covered are:
•	QAcademy Gamma — My NMC Licensure + My Teacher (individual students and teachers)
•	QAcademy Beta — multi-tenant exam platform for schools and institutions
•	Future: institutional organisation accounts bridging both platforms


Priority Order — What to Do and When
You do not need everything in place before your first user. But certain things must be done before specific milestones. Use this as your action checklist.

Action	Before	Status
Register business (LLC)	First paying customer	
Get TIN from Ghana Revenue Authority	First paying customer	
Publish Privacy Policy on all platforms	First paying customer	
Publish Terms of Service on all platforms	First paying customer	
Register with Data Protection Commission	First paying customer	
Accept Cloudflare Data Processing Addendum	First paying customer	
Accept Supabase Data Processing Addendum	First paying customer	
Have lawyer review school agreement template	First school contract	
Set up basic bookkeeping (Wave or similar)	First invoice issued	
Trademark QAcademy at GIPC	Revenue growing	
Engage accountant for tax filings	Revenue growing	
Review VAT registration threshold	GHS 200k turnover	


1. Business Registration
You need a legally registered business entity to enter contracts, open a business bank account, and be taken seriously by institutional clients like schools and exam bodies.
Sole Proprietorship vs Limited Liability Company
A Sole Proprietorship is the simplest option — register a business name, quick and cheap. However you are personally liable for any debts or legal claims against the business.

A Limited Liability Company (LLC) separates you legally from the business. If something goes wrong your personal assets are protected. It costs more and has more administrative requirements but is strongly recommended if you are taking money from institutions.

Recommendation: Register an LLC from the start. The credibility difference when approaching schools and exam bodies is significant. A school administrator is far more comfortable signing a contract with "QAcademy Limited" than with your personal name.
Steps at the Registrar General's Department
1.	Choose and reserve your company name
2.	Complete Form 3 (regulations) and Form 4 (particulars of directors)
3.	Pay the registration fee — approximately GHS 450–600 depending on share capital
4.	You will need at least one director, a registered office address in Ghana, and a stated share capital
5.	Processing takes approximately 3–5 working days
6.	You will receive a Certificate of Incorporation and a Certificate to Commence Business
After Registration
•	Register for tax with the Ghana Revenue Authority (GRA) — you will receive a Tax Identification Number (TIN)
•	Open a business bank account — you will need your incorporation certificate


2. Data Protection
This is the most critical compliance area. You handle student data, exam results, payment information, and in the case of Beta, data belonging to schools and potentially minors.
Ghana Data Protection Act 2012 (Act 843)
The law applies to any person or organisation that processes personal data. You must register with the Data Protection Commission before processing personal data. This is a legal requirement — failure to register is a criminal offence under the Act.
Registration with the Data Protection Commission
•	Costs a small fee
•	Requires you to describe what data you collect, why, and how you protect it
•	Must be renewed periodically
•	Contact: www.dataprotection.org.gh
The Eight Data Protection Principles

Principle	What It Means for QAcademy
Accountability	You are responsible for all data in your possession
Lawfulness	You must have a legal basis for collecting data — user consent
Specification	State clearly why you collect each piece of data
Compatibility	Data must only be used for the stated purpose
Quality	Data must be accurate and kept up to date
Openness	Be transparent in your privacy policy about your data practices
Data Security	Protect data against unauthorised access — your Supabase/Cloudflare setup already helps here
Data Subject Participation	Users have the right to access and correct their own data

Practical Implications
For Gamma (My NMC Licensure)
When a student registers you collect their name, email, phone, programme, and payment information. You need their informed consent. Your registration form must include a clear checkbox where they agree to your privacy policy — not buried in small print.
For Beta (Schools)
You are handling school data which may include data about minors. This significantly elevates your obligations. You need explicit data processing agreements with schools, and schools need their own parental/guardian consent where applicable.
Sensitive Data
Exam scores and academic performance are considered sensitive personal data. You have heightened obligations around how you store, process, and share this information.


3. Terms of Service and Privacy Policy
Every platform must have these published and accessible before going live with real users. They protect you when things go wrong and are required for Data Protection Commission compliance.
Privacy Policy — Required Content
•	Who you are and how to contact you
•	What personal data you collect and why
•	How you collect it — directly from users, automatically, from third parties
•	How long you keep data
•	Who you share it with — Supabase, Cloudflare, and Paystack must be disclosed as third party processors
•	Users' rights — access, correction, deletion
•	How you protect data
•	How you handle data breaches
•	Cookie policy
Terms of Service — Gamma
•	Who can use the platform — age restrictions and parental consent if students could be under 18
•	What you provide — make clear QAcademy is a revision tool, not a guarantee of exam success
•	Payment terms — refund policy, what happens when a subscription expires
•	Acceptable use — no account sharing, no distributing question content
•	Intellectual property — your content belongs to you
•	Liability limitation — you are not liable for exam failures
•	Termination — when you can close an account
•	Governing law — Ghana law applies
Terms of Service — Beta (Additional Clauses)
•	Service level expectations — be honest about what uptime you can commit to as a solo builder
•	Data ownership — the school owns their exam content and student data; you own the platform
•	Data return/deletion — on termination you will export their data within 14 days and then delete it
•	Liability cap — limit your exposure to the amount the school paid you in the preceding 12 months
•	Indemnification — the school is responsible for their own exam content
•	Renewal and cancellation terms — 30 days notice either side
•	Governing law — Ghana law, disputes in Ghanaian courts

Important: Do not copy terms from another website. Ghana law applies to you and generic templates from US companies will not fully protect you. Have a Ghanaian lawyer review your terms when you are ready. The cost is modest and worth it.


4. Payment and Tax Compliance
Income Tax
As a registered business you must file annual returns with the Ghana Revenue Authority. Your platform revenue is taxable business income. Keep records of every transaction — Paystack gives you a full transaction dashboard which makes this straightforward.
VAT
Businesses with annual turnover above GHS 200,000 must register for VAT in Ghana. Once you cross that threshold you must charge VAT on your services and remit quarterly to GRA. Monitor your turnover and register before you hit the threshold, not after.
Receipts and Invoicing
•	Every paying customer is entitled to a receipt
•	Paystack automatically sends payment confirmation emails which serve as receipts for individual students
•	For school contracts issue proper invoices and receipts — Wave (free accounting tool) handles this well
Withholding Tax
When paying for services — for example hiring a developer or designer — you may need to withhold tax from their payment and remit to GRA. Seek accountant advice when you reach this stage.
Recommendation
Engage a part-time bookkeeper or accountant early to handle quarterly and annual filings. The cost is low relative to the peace of mind it provides.


5. School Contracts for Beta
When a school signs up for Beta you need a written agreement. This is not optional for institutional clients — schools and their governing bodies will expect it. It protects both parties.
Key Sections of a School Agreement
Services Description
Exactly what you are providing — platform access, number of users, storage limits, support channels, and what is not included.
Subscription Terms
Price, billing cycle, how renewal works, grace period, and what happens if they do not pay.
Data Processing Agreement
This is critical. Under Ghana's Data Protection Act when a school provides student data to you, they remain the data controller and you become a data processor. The agreement must state:
•	You only process data on the school's instructions
•	You implement appropriate security measures
•	You do not share data with unauthorised parties
•	You will delete or return data when the contract ends
•	You will notify them promptly of any data breach
Content Ownership
The school owns their exam questions, student lists, and results. You own the platform. This must be crystal clear.
Acceptable Use
The school is responsible for how their teachers and students use the platform. They cannot use it for anything illegal or harmful.
Uptime and Support
Be honest. As a solo builder, commit to 'best efforts' with a 48-hour support response time rather than promising 99.9% uptime you cannot guarantee.
Liability Limitation
Cap your liability at the amount the school paid you in the preceding 12 months. This is standard practice and protects you from catastrophic claims.
Termination
Either party may terminate with 30 days written notice. On termination you will export their data in a readable format within 14 days and permanently delete it.


6. Intellectual Property
Trademark — QAcademy Brand Name
Register QAcademy as a trademark with the Ghana Intellectual Property Office (GIPC). This prevents others from using the same name in the same industry.
Steps
7.	Search the trademark register at GIPC to confirm the name is available
8.	File a trademark application with GIPC
9.	Cost: approximately $100–200 USD equivalent
10.	Processing time: several months
11.	Coverage: Ghana only — international registrations needed for expansion
Your Code
Under Ghana's Copyright Act your software code is automatically protected as a literary work from the moment you create it. No registration required. Your GitHub commit history serves as evidence of when you built what — keep it intact.
Your Content
Question banks, course materials, and original educational content you create are automatically copyright protected. Make clear in your terms that users cannot export and redistribute your content.
Domain Names
Ensure you own your domain names directly in your own name or company name — not through a third party. If someone else registered your domain for you, transfer it to your own account immediately.


7. Infrastructure Compliance
Your technology choices have already put you ahead of most small platforms from a compliance perspective. Here is what each provider covers and what you need to do.
Cloudflare
•	SOC 2 Type II certified and GDPR compliant
•	Accept the Data Processing Addendum (DPA) in your Cloudflare dashboard — this formally establishes the data processor relationship
•	Disclose Cloudflare as a third party processor in your privacy policy
•	Data is processed at global edge nodes — document this for the Data Protection Commission
Supabase
•	SOC 2 Type II certified
•	Data stored on AWS infrastructure in the region you selected when creating your project — check which region and document it
•	Accept the Supabase DPA in your project settings
•	Critical: your Supabase service role key must only live in Cloudflare Worker environment variables — never in frontend code. This is already correctly implemented in your payments worker.
Paystack
•	Licensed by the Central Bank of Nigeria and approved by the Bank of Ghana
•	PCI DSS compliant — you never handle raw card data yourself, which significantly reduces your compliance burden
•	Review your Paystack merchant agreement carefully — maintain accurate business information and do not use it for prohibited business types
Why Your Stack Works in Your Favour
Using Cloudflare, Supabase, and Paystack rather than self-hosted infrastructure means you inherit significant compliance posture from certified providers. You are not storing passwords in plain text on a private server. This matters when demonstrating compliance to schools, institutions, and the Data Protection Commission.


Key Contacts and Resources

Organisation	Purpose / Contact
Registrar General's Department	Business registration — rgd.gov.gh
Ghana Revenue Authority	TIN, income tax, VAT — gra.gov.gh
Data Protection Commission	Data controller registration — dataprotection.org.gh
Ghana Intellectual Property Office (GIPC)	Trademark registration — gipc.gov.gh
Paystack	Payment processing — paystack.com/gh
Cloudflare Trust & Safety	DPA acceptance — cloudflare.com/trust-hub
Supabase	DPA acceptance — supabase.com/privacy

QAcademy — Confidential Internal Document — March 2026
