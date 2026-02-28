import { Suspense } from "react";
import { NewResourceClient } from "./new-resource-client";

export default function NewResourcePage() {
  return (
    <Suspense>
      <NewResourceClient />
    </Suspense>
  );
}
