import type { Deps } from "./deps";
import type { Env } from "./env";
import type { StudentAccount, TeacherAccount } from "./lib/session";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    reqId: string;
    deps: Deps;
    teacher: TeacherAccount;
    student: StudentAccount;
    sessionHash: string;
  };
};
