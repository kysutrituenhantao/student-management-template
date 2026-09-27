"use client";

import { Suspense } from "react";
import { StudentApp } from "@/components/student/student-app";
import { Loading } from "@/components/ui";
import { useStudent } from "@/lib/session";

function Area() {
  const me = useStudent();
  if (!me) return <Loading />;
  return <StudentApp me={me} />;
}

export default function StudentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Area />
    </Suspense>
  );
}
