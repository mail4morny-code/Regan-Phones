import { requireProfileRole } from "@/lib/auth/requireProfile";
import AddPhoneForm from "@/components/phones/AddPhoneForm";

export default async function AddPhonePage() {
  await requireProfileRole();

  return (
    <div>
      <AddPhoneForm />
    </div>
  );
}


