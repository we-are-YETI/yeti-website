import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, listAll, ref, uploadBytes } from "firebase/storage";

const environment = await initializeTestEnvironment({
  projectId: "demo-yeti-blog",
  firestore: {
    host: "127.0.0.1",
    port: 8085,
    rules: await readFile("firebase/firestore.rules", "utf8"),
  },
  storage: {
    host: "127.0.0.1",
    port: 9195,
    rules: await readFile("firebase/blog.storage.rules", "utf8"),
  },
});
const writer = environment.authenticatedContext("writer", {
  email: "writer@yeti-dresden.org",
  email_verified: true,
});
const other = environment.authenticatedContext("other", {
  email: "other@yeti-leipzig.org",
  email_verified: true,
});
const outsider = environment.authenticatedContext("outside", {
  email: "person@gmail.com",
  email_verified: true,
});
const unverified = environment.authenticatedContext("unverified", {
  email: "person@yeti-dresden.org",
  email_verified: false,
});
const editor = environment.authenticatedContext("editor", {
  email: "editor@yeti-leipzig.org",
  email_verified: true,
});
const admin = environment.authenticatedContext("admin", {
  email: "admin@yeti-dresden.org",
  email_verified: true,
});
const guest = environment.unauthenticatedContext();
const article = {
  id: "story",
  authorId: "writer",
  authorName: "Writer",
  linkedin: "https://www.linkedin.com/in/writer",
  title: "My project",
  html: "<p>My project</p>",
  status: "draft",
  feedback: "",
  updatedAt: 1,
};
try {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    for (const [id, role] of [
      ["editor", "content"],
      ["admin", "admin"],
    ])
      await setDoc(doc(context.firestore(), "blogUsers", id), {
        email: `${id}@yeti-leipzig.org`,
        role,
      });
  });
  const invited = environment.authenticatedContext("invited", {
    email: "afshin.zanganeh@yeti-dresden.org",
    email_verified: true,
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(
        context.firestore(),
        "blogInvitations",
        "afshin.zanganeh@yeti-dresden.org",
      ),
      { role: "admin" },
    );
  });
  await assertSucceeds(
    getDoc(
      doc(
        invited.firestore(),
        "blogInvitations",
        "afshin.zanganeh@yeti-dresden.org",
      ),
    ),
  );
  await assertFails(
    getDoc(
      doc(
        writer.firestore(),
        "blogInvitations",
        "afshin.zanganeh@yeti-dresden.org",
      ),
    ),
  );
  await assertSucceeds(
    setDoc(doc(invited.firestore(), "blogUsers", "invited"), {
      email: "afshin.zanganeh@yeti-dresden.org",
      role: "admin",
    }),
  );
  await assertFails(
    setDoc(
      doc(writer.firestore(), "blogInvitations", "writer@yeti-dresden.org"),
      { role: "admin" },
    ),
  );
  await assertSucceeds(
    setDoc(doc(guest.firestore(), "credentials/waitlist/logins", "test"), {
      source: "rule compatibility check",
    }),
  );
  await assertSucceeds(
    setDoc(doc(writer.firestore(), "blogUsers", "writer"), {
      email: "writer@yeti-dresden.org",
      role: "member",
    }),
  );
  await assertFails(
    setDoc(doc(other.firestore(), "blogUsers", "other"), {
      email: "other@yeti-leipzig.org",
      role: "admin",
    }),
  );
  await assertFails(
    setDoc(doc(outsider.firestore(), "blogDrafts", "story"), article),
  );
  await assertFails(
    setDoc(doc(unverified.firestore(), "blogDrafts", "story"), article),
  );
  await assertSucceeds(getDoc(doc(writer.firestore(), "blogDrafts", "story")));
  await assertSucceeds(
    setDoc(doc(writer.firestore(), "blogDrafts", "story"), article),
  );
  await assertFails(getDoc(doc(other.firestore(), "blogDrafts", "story")));
  await assertFails(getDoc(doc(guest.firestore(), "blogDrafts", "story")));
  await assertFails(
    updateDoc(doc(writer.firestore(), "blogUsers", "writer"), {
      role: "admin",
    }),
  );
  await assertFails(
    updateDoc(doc(writer.firestore(), "blogDrafts", "story"), {
      status: "published",
    }),
  );
  await assertFails(
    updateDoc(doc(writer.firestore(), "blogDrafts", "story"), {
      feedback: "forged review",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(writer.firestore(), "blogDrafts", "story"), {
      status: "review",
    }),
  );
  await assertFails(
    updateDoc(doc(writer.firestore(), "blogDrafts", "story"), {
      linkedin: "https://example.com",
    }),
  );
  const published = { ...article, status: "published" };
  delete published.feedback;
  const batch = writeBatch(editor.firestore());
  batch.update(doc(editor.firestore(), "blogDrafts", "story"), {
    status: "published",
  });
  batch.set(doc(editor.firestore(), "blogPublished", "story"), published);
  await assertSucceeds(batch.commit());
  await assertSucceeds(
    getDoc(doc(guest.firestore(), "blogPublished", "story")),
  );
  await assertSucceeds(getDocs(collection(guest.firestore(), "blogPublished")));
  await assertFails(
    setDoc(doc(writer.firestore(), "blogPublished", "story"), published),
  );
  await assertSucceeds(
    updateDoc(doc(writer.firestore(), "blogDrafts", "story"), {
      status: "draft",
      title: "New draft",
    }),
  );
  const live = await getDoc(doc(guest.firestore(), "blogPublished", "story"));
  if (live.data().title !== "My project")
    throw new Error("Draft changed the published article");
  await assertSucceeds(
    updateDoc(doc(admin.firestore(), "blogUsers", "writer"), {
      role: "content",
    }),
  );
  await assertFails(
    updateDoc(doc(admin.firestore(), "blogUsers", "admin"), { role: "member" }),
  );
  const image = new Uint8Array([1, 2, 3]);
  await assertSucceeds(
    uploadBytes(ref(writer.storage(), "blog-images/writer/test.webp"), image, {
      contentType: "image/webp",
    }),
  );
  await assertSucceeds(
    getDownloadURL(ref(guest.storage(), "blog-images/writer/test.webp")),
  );
  await assertFails(listAll(ref(guest.storage(), "blog-images/writer")));
  await assertFails(
    uploadBytes(
      ref(outsider.storage(), "blog-images/outside/test.webp"),
      image,
      { contentType: "image/webp" },
    ),
  );
  await assertFails(
    uploadBytes(ref(writer.storage(), "blog-images/other/test.webp"), image, {
      contentType: "image/webp",
    }),
  );
  await assertFails(
    uploadBytes(ref(writer.storage(), "blog-images/writer/test.html"), image, {
      contentType: "text/html",
    }),
  );
  console.log(
    "Blog authorization, publication isolation and image upload checks passed.",
  );
} finally {
  await environment.cleanup();
}
