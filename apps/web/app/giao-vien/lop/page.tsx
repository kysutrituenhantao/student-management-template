"use client";

import { Suspense } from "react";
import { ClassWorkspace } from "@/components/teacher/workspace";
import { Loading } from "@/components/ui";
import { useTeacher } from "@/lib/session";

function Workspace() {
  const me = useTeacher();
  if (!me) return <Loading />;
  return <ClassWorkspace me={me} />;
}

export default function ClassPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Workspace />
    </Suspense>
  );
}
