"use client";

import dynamicImport from "next/dynamic";
import { ReactNode } from "react";

const Providers = dynamicImport(() => import("./Providers"), { ssr: false });

export default function DynamicProviders({ children }: { children: ReactNode }) {
    return <Providers>{children}</Providers>;
}
