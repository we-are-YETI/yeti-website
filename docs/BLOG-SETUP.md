# Firebase blog setup

The new blog uses Firebase Auth, Firestore and Storage. `/blogs` lists published articles, `/blogs/submit` contains the writing/review/admin workspace, and `/blogs/article?id=DOCUMENT_ID` displays an article. These routes work with the existing static export. Published text loads in the browser, so crawler/social previews do not have per-article server-rendered metadata. New articles require no site rebuild. The previous Sheets blog is disconnected and old title-based article routes are removed.

## Firebase configuration

1. In project `yeti-dresden`, enable Google sign-in under Authentication and add the production website and local development domains to Authorized domains. The UI signs out accounts outside the two allowed domains. Database and Storage rules independently require a verified `yeti-dresden.org` or `yeti-leipzig.org` email. This does not prevent Google/Firebase from briefly creating an Auth account for an outside address. If preventing even account creation is required, add Identity Platform blocking functions or enforce organization access at the identity provider.
2. Enable Firestore and the `yeti-dresden.firebasestorage.app` bucket. Storage requires a linked billing account on Blaze. Confirm the bucket matches `lib/firebase.ts`.
3. `firebase/firestore.rules` contains the merged blog rules and the existing deployed waitlist submission rules. `firebase/blog.storage.rules` protects image uploads. Deploy with `firebase deploy --only firestore:rules,storage --project yeti-dresden`. The isolated blog Firestore fragment is retained in `firebase/blog.firestore.rules`. Keep it synchronized with the merged file when editing blog permissions. The emulator tests exercise the merged rules.
4. An administrator invitation is provisioned at `blogInvitations/afshin.zanganeh@yeti-dresden.org` with `role: admin`. On the first verified organizational sign-in, the workspace uses that protected invitation to create the user profile with the assigned role. All other new users default to member. Subsequent role changes are available in the workspace. Administrators cannot demote themselves. Members must sign in once before appearing in the role list.
5. Deploy the site once using its existing static-hosting release process. Content publication afterward only updates Firestore.

## Editorial workflow

Members can create and edit their own drafts, see previous submissions and review feedback, and submit for review. Content users can access all drafts, request changes with feedback, publish and unpublish. Administrators also assign roles and delete articles. Publishing atomically writes a separate public snapshot. Editing or resubmitting a published article leaves the current public snapshot available until a reviewer republishes or unpublishes it. Review feedback and member emails remain private.

The editor supports formatting, inline image upload, preview and an article outline. Images are resized to at most 1600 px wide and converted to WebP before upload. Public image URLs are immutable. Uploaded images are publicly accessible, including images in drafts; article text remains private until publication. Deleting an article does not delete image files, because they may still be referenced elsewhere. Unused uploads can be removed separately by an administrator. Writers explicitly save drafts, with warnings for unsaved changes and transaction-based conflict detection.

The author name, title and LinkedIn profile are required for submission/publication. The editorial guidelines are displayed inline in the workspace. The website editor uses the website typography.

## Verification

Run `firebase emulators:exec --project demo-yeti-blog --config firebase.blog.json --only firestore,storage 'node scripts/test-blog-rules.mjs'` to verify organization restrictions, ownership, role escalation prevention, private drafts, publication isolation, and image-upload restrictions locally.

After the cloud setup, verify a Dresden member and Leipzig member can sign in and submit, an outside account cannot use the workspace, a content user can publish, a guest can read the public article, pending edits do not change it, and an administrator can assign roles. Google OAuth and live Storage uploads require these real project settings and cannot be verified solely by the local rule tests.

## Provisioned resources

The image bucket is `yeti-dresden.firebasestorage.app` in Frankfurt (`europe-west3`). Billing was already enabled on the project. The Firebase Storage API was enabled during setup. The Firebase authorized-domain list includes localhost, the existing Firebase domains, and the root/www versions of yeti-dresden.org and yeti-leipzig.org. Google sign-in is enabled and its OAuth client configuration was verified. Both Firestore and Storage rules have been deployed. Live unauthenticated checks returned HTTP 200 for published articles and HTTP 403 for private drafts.

## Review deployment

A temporary Firebase Hosting preview is available at https://yeti-dresden--blog-review-jkkcvoyr.web.app/blogs (expires November 25, 2026). Its hostname is authorized for Google sign-in. The production build and TypeScript checks passed after restoring the missing `COMMUNITY_INFO` import in `app/wtf/page.tsx`. The main website hosting release remains pending review.
