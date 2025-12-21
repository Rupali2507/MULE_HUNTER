"use server";

import dbConnect from "@/lib/mongodb";
// import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function createUserAction(formData: FormData) {
  await dbConnect();

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    revalidatePath("/admin"); //refersh admin page
    return { success: true };
  } catch (error) {
    return { error: "Failed to create user. Email might already exist." };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    await dbConnect();
    await User.findByIdAndDelete(userId);

    revalidatePath("/admin"); //refresh
    
    return { success: true };
  } catch (error) {
    return { error: "Failed to revoke access." };
  }
}