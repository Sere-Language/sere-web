"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/app/hooks/useAuthSession";
import { getLastOpenedMap } from "@/app/lib/projectActivity";
import {
  listProjects,
  type CloudProject,
  type ProjectKind,
} from "@/app/lib/projects";
import Button from "./Button";
import CloudSnapshot from "./CloudSnapshot";
import CreateProjectDialog from "./CreateProjectDialog";
import Grid from "./Grid";
import Heading from "./Heading";
import ProjectTile from "./ProjectTile";
import Reveal from "./Reveal";
import Stack from "./Stack";
import Text from "./Text";

const FEATURES = [
  {
    kicker: "01",
    title: "Editor",
    body: "Files, Monaco, a real terminal, and LLVM IR in one dock. Same layout you get locally.",
  },
  {
    kicker: "02",
    title: "Compile",
    body: "Build and run in a Linux VM in this tab (NanoVM). Same native Sere when linux.zip includes a guest binary, not a remote LLVM farm.",
  },
  {
    kicker: "03",
    title: "Projects",
    body: "Apps and libraries live on your account. Open them from any browser.",
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Create a workspace",
    body: "App or library. You get the same layout as sere init.",
  },
  {
    step: "02",
    title: "Edit in the cloud",
    body: "Open files, save, and keep the tree in sync with storage.",
  },
  {
    step: "03",
    title: "Build and run",
    body: "Ctrl+B compiles in the VM. Ctrl+Enter runs. Output and IR land in the dock.",
  },
] as const;

export default function CloudOverview() {
  const { signedIn, ready } = useAuthSession();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [lastOpened, setLastOpened] = useState<Record<string, number>>({});
  const [createKind, setCreateKind] = useState<ProjectKind | null>(null);

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    void listProjects()
      .then((next) => {
        setProjects(next);
        setLastOpened(getLastOpenedMap());
      })
      .catch(() => {
        setProjects([]);
      });
  }, [signedIn]);

  const recent = [...projects]
    .sort((left, right) => {
      const leftTime = lastOpened[left.slug] ?? Date.parse(left.createdAt);
      const rightTime = lastOpened[right.slug] ?? Date.parse(right.createdAt);
      return rightTime - leftTime;
    })
    .slice(0, 3);

  return (
    <Stack gap="lg">
      <div className="relative overflow-hidden pb-2 text-left">
        <div className="relative flex flex-col items-start gap-5">
          <p className="m-0 text-xs font-medium uppercase tracking-wider text-primary">
            Sere Cloud
          </p>
          <Heading className="max-w-3xl">
            The workbench,
            <br />
            <span className="hero-compiled">in the browser.</span>
          </Heading>
          <Text muted className="max-w-xl text-base leading-7">
            Edit, compile, and run Sere without installing the toolchain. Your files, terminal, and compiler output share one workspace.
          </Text>
          {!ready ? <div className="h-10 w-56" aria-hidden /> : null}
          {ready && signedIn ? (
            <div className="flex flex-wrap justify-start gap-3">
              <Button href="/cloud/dashboard" className="px-4 py-2">
                Open dashboard
              </Button>
              <Button variant="ghost" className="px-4 py-2" onClick={() => setCreateKind("app")}>
                New project
              </Button>
            </div>
          ) : null}
          {ready && !signedIn ? (
            <div className="flex flex-wrap justify-start gap-3">
              <Button href="/cloud/auth/signup" className="px-4 py-2">
                Sign up free
              </Button>
              <Button href="/cloud/auth/login" variant="ghost" className="px-4 py-2">
                Sign in
              </Button>
              <Button href="/install" variant="ghost" className="px-4 py-2">
                Local install
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Reveal>
        <CloudSnapshot priority />
      </Reveal>

      {signedIn && recent.length > 0 ? (
        <Stack gap="sm">
          <div className="flex items-center justify-between gap-3">
            <Heading level={3}>Continue</Heading>
            <Button href="/cloud/projects" variant="ghost">
              All projects
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {recent.map((project) => (
              <ProjectTile
                key={project.id}
                project={project}
                lastOpened={
                  lastOpened[project.slug]
                    ? new Date(lastOpened[project.slug]).toISOString()
                    : null
                }
              />
            ))}
          </div>
        </Stack>
      ) : null}

      <Grid cols={3}>
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={index * 80}>
            <div className="border-t border-border pt-5">
              <Stack gap="sm">
                <p className="m-0 font-mono text-[11px] text-primary">{feature.kicker}</p>
                <Heading level={3}>{feature.title}</Heading>
                <Text muted className="text-sm leading-6">
                  {feature.body}
                </Text>
              </Stack>
            </div>
          </Reveal>
        ))}
      </Grid>

      <div className="grid grid-cols-1 gap-px border-y border-border bg-border sm:grid-cols-3">
        {STEPS.map((item) => (
          <div key={item.step} className="bg-card px-5 py-6">
            <p className="m-0 font-mono text-[11px] text-primary">{item.step}</p>
            <p className="m-0 mt-2 text-sm font-semibold tracking-tight">{item.title}</p>
            <p className="m-0 mt-1 text-xs leading-5 text-muted">{item.body}</p>
          </div>
        ))}
      </div>

      <CreateProjectDialog
        open={createKind !== null}
        initialKind={createKind ?? "app"}
        onClose={() => setCreateKind(null)}
      />
    </Stack>
  );
}
