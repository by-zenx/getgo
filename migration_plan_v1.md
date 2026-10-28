1.Fix the base. Make next build pass (5 type errors), fix the lockfile and lint errors, delete the scratch file, and merge the duplicated nav config into one. No UI changes.
2.Shared foundation. One set of fake CRM data (people, companies, leads, deals, quotes, events, projects) with consistent links between them.
3.Contacts. Rename Customers, then add the People and Companies submenu. Everything else links to these, so they come first.
4.Pipeline. Turn the Workspace into the deals board with the forecast, and keep the Workspace boards as Projects for work in progress.
5.Leads. Rename Messages (Inbox and Email) and add the lead score, source and owner.
6.Schedule. Port rapport’s schedule UI into Corbel’s shell.
7.Sales. Rename Orders to Sales (Quotes → Orders → Invoices), and Products to Catalog. This is my default for those two, which you haven’t confirmed.
8.Finance. New screen next to Analytics, either ported from rapport or built new, depending on which fits better.
9.Analytics. Re-label it with CRM reports: win rate, funnel and lead source.
10.Dashboard. Last, because it summarises everything above, so swap the store KPIs for pipeline KPIs.
11.Final pass. Make ⌘K search and notifications cover the new areas, check empty states, and decide what to do with Help and Feedback.