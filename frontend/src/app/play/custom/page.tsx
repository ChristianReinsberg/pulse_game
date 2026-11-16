import type { Metadata } from "next";
import CustomGame from "@/components/CustomGame";

export const metadata: Metadata = { title: "Eigenes Level · Pulse" };

export default function CustomPlayPage() {
  return <CustomGame />;
}
