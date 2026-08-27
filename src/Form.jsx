import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import * as yup from "yup";
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUsersQuery,
  useLazyGetUserByIdQuery,
  useUpdateUserMutation,
} from "./services/usersApi";

const indianPhoneRegex = /^(?:(?:\+|00)91)?[6-9]\d{9}$/;
const indianPhoneInputRegex = /^(?:(?:\+|00)91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
const nameRegex = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const ageRegex = /^(?:1[3-9]|[2-9]\d|1[01]\d|120)$/;
const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 3 * 1024 * 1024;
const currentDate = new Date();
const today = [
  currentDate.getFullYear(),
  String(currentDate.getMonth() + 1).padStart(2, "0"),
  String(currentDate.getDate()).padStart(2, "0"),
].join("-");

const schema = yup.object({
  name: yup
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be 50 characters or less")
    .matches(nameRegex, "Name can contain letters and spaces only")
    .required("Name is required"),
  email: yup
    .string()
    .matches(emailRegex, "Enter a valid email")
    .required("Email is required"),
  password: yup
    .string()
    .matches(
      passwordRegex,
      "Use 8+ chars with uppercase, lowercase, number and symbol",
    )
    .required("Password is required"),
  confirmPassword: yup
    .string()
    .matches(passwordRegex, "Use the same valid password")
    .oneOf([yup.ref("password")], "Passwords must match")
    .required("Please confirm your password"),
  age: yup
    .string()
    .matches(ageRegex, "Age must be a whole number from 13 to 120")
    .required("Age is required"),
  dob: yup
    .string()
    .matches(dobRegex, "Enter a valid date of birth")
    .required("Date of birth is required")
    .test("not-future", "Date of birth cannot be in the future", (value) => {
      return Boolean(value && value <= today);
    }),
  phone: yup
    .string()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .matches(indianPhoneRegex, "Enter a valid Indian mobile number")
    .required("Phone number is required"),
  studentPic: yup
    .mixed()
    .required("Student picture is required")
    .test("image-type", "Only JPG, PNG or WEBP images are allowed", (value) => {
      if (typeof value === "string") return true;
      const file = value?.[0];
      return Boolean(file && allowedImageTypes.includes(file.type));
    })
    .test("image-size", "Image size must be 2 MB or less", (value) => {
      if (typeof value === "string") return true;
      const file = value?.[0];
      return Boolean(file && file.size <= maxImageSize);
    }),
});

const fields = [
  ["name", "Name", "text"],
  ["email", "Email", "email"],
  ["password", "Password", "password"],
  ["confirmPassword", "Confirm password", "password"],
  ["age", "Age", "number"],
  ["dob", "Date of birth", "date"],
  ["phone", "Phone number", "tel"],
  ["studentPic", "Student picture", "file"],
];

const fieldRules = {
  name: {
    pattern: {
      value: nameRegex,
      message: "Name can contain letters and spaces only",
    },
  },
  email: { pattern: { value: emailRegex, message: "Enter a valid email" } },
  password: {
    pattern: {
      value: passwordRegex,
      message: "Use 8+ chars with uppercase, lowercase, number and symbol",
    },
  },
  confirmPassword: {
    pattern: { value: passwordRegex, message: "Use the same valid password" },
  },
  age: {
    pattern: {
      value: ageRegex,
      message: "Age must be a whole number from 13 to 120",
    },
  },
  phone: {
    pattern: {
      value: indianPhoneInputRegex,
      message: "Enter a valid Indian mobile number",
    },
  },
};

const Form = () => {
  const [editingUser, setEditingUser] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const { data: users = [] } = useGetUsersQuery();
  const [createUser, { isLoading }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [getUserById, { isFetching: isFetchingUser }] = useLazyGetUserByIdQuery();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      age: "",
      dob: "",
      phone: "",
      studentPic: null,
    },
  });
  const watchedProfile = watch(["name", "email", "age", "phone"]);

  const imageToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        const maxDimension = 900;
        const scale = Math.min(
          1,
          maxDimension / Math.max(image.width, image.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas
          .getContext("2d")
          .drawImage(image, 0, 0, canvas.width, canvas.height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 90 * 1024 && quality > 0.2) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read image"));
      };
      image.src = objectUrl;
    });

  const onSubmit = async (user) => {
    const profile = { ...user };
    delete profile.confirmPassword;
    try {
      if (profile.studentPic?.[0]) {
        profile.studentPic = await imageToDataUrl(profile.studentPic[0]);
      }
      const request = editingUser
        ? updateUser({
            id: editingUser.id,
            ...profile,
            age: Number(profile.age),
          })
        : createUser({ ...profile, age: Number(profile.age) });
      await toast.promise(request.unwrap(), {
        pending: editingUser ? "Updating profile..." : "Creating profile...",
        success: editingUser ? "Profile updated" : "Profile created",
        error: editingUser
          ? "Could not update profile"
          : "Could not create profile",
      });
      reset();
      setImagePreview("");
      setEditingUser(null);
    } catch {
      return;
    }
  };

  const handleEdit = async (user) => {
    try {
      const profile = await getUserById(user.id).unwrap();
      setEditingUser(profile);
      setImagePreview(profile.studentPic || "");
      reset({ ...profile, confirmPassword: profile.password || "" });
    } catch {
      toast.error("Could not load profile");
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setImagePreview("");
    reset();
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    setValue("studentPic", null, { shouldValidate: true });
    document.getElementById("studentPic").value = "";
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete profile?",
      text: "This profile will be permanently deleted.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#bf5539",
      cancelButtonColor: "#183d36",
    });

    if (!result.isConfirmed) return;
    try {
      await toast.promise(deleteUser(id).unwrap(), {
        pending: "Deleting profile...",
        success: "Profile deleted",
        error: "Could not delete profile",
      });
      if (editingUser?.id === id) handleCancelEdit();
    } catch {
      return;
    }
  };

  return (
    <>
      <section className="content-grid">
        <form
          className="profile-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="form-grid">
            {fields.map(([name, label, type]) => {
              const registration = register(name, fieldRules[name]);

              const handleInput = (event) => {
                if (name === "name") {
                  event.target.value = event.target.value.replace(
                    /[^A-Za-z ]/g,
                    "",
                  );
                }
                if (name === "email") {
                  event.target.value = event.target.value.replace(
                    /[^A-Za-z0-9._%+@-]/g,
                    "",
                  );
                }
                if (name === "age") {
                  event.target.value = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 3);
                }
                if (name === "studentPic" && event.target.files?.[0]) {
                  const reader = new FileReader();
                  reader.onload = () => setImagePreview(reader.result);
                  reader.readAsDataURL(event.target.files[0]);
                }
                registration.onChange(event);
              };

              return (
                <label
                  className={
                    name === "phone" || name === "studentPic"
                      ? "field field-wide"
                      : "field"
                  }
                  key={name}
                  htmlFor={name}
                >
                  <span>{label}</span>
                  <input
                    id={name}
                    type={type}
                    min={name === "age" ? 13 : undefined}
                    max={
                      name === "dob" ? today : name === "age" ? 120 : undefined
                    }
                    accept={
                      name === "studentPic"
                        ? "image/jpeg,image/png,image/webp"
                        : undefined
                    }
                    inputMode={name === "age" ? "numeric" : undefined}
                    placeholder={
                      name === "phone" ? "+91 9876543210" : undefined
                    }
                    {...registration}
                    onChange={handleInput}
                    aria-invalid={Boolean(errors[name])}
                  />
                  {errors[name] && <small>{errors[name].message}</small>}
                  {name === "studentPic" && imagePreview && (
                    <div className="image-preview-wrap">
                      <img
                        className="image-preview"
                        src={imagePreview}
                        alt="Student preview"
                      />
                      <button
                        type="button"
                        className="image-remove-button"
                        onClick={handleRemoveImage}
                        aria-label="Remove image"
                        title="Remove image"
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </label>
              );
            })}
          </div>
          <button type="submit" disabled={isLoading || isUpdating}>
            {isLoading || isUpdating
              ? "Saving..."
              : editingUser
                ? "Update profile"
                : "Create profile"}
          </button>
          {editingUser && (
            <button
              type="button"
              className="cancel-button"
              onClick={handleCancelEdit}
            >
              Cancel edit
            </button>
          )}
        </form>
        <aside className="directory-summary">
          <span className="summary-label">Saved profiles</span>
          <strong>{users.length}</strong>
          <p>Profiles returned by JSON Server</p>
          <div className="live-preview">
            <span className="summary-label">Live preview</span>
            <p>{watchedProfile[0] || "Your name"}</p>
            <small>{watchedProfile[1] || "Your email"}</small>
            <small>
              {watchedProfile[2] || "Age"}{" "}
              {watchedProfile[3] && `| ${watchedProfile[3]}`}
            </small>
          </div>
        </aside>
      </section>
      <section className="users-section">
        <div className="users-heading">
          <span className="summary-label">Directory</span>
          <h2>Submitted profiles</h2>
        </div>
        <div className="user-list">
          {users.map((user) => (
            <article className="user-row" key={user.id}>
              {user.studentPic && (
                <img
                  className="user-photo"
                  src={user.studentPic}
                  alt={`${user.name} profile`}
                />
              )}
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  onClick={() => handleEdit(user)}
                  disabled={isFetchingUser}
                >
                  {isFetchingUser ? "Loading..." : "Edit"}
                </button>
                <button type="button" onClick={() => handleDelete(user.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
          {!users.length && (
            <p className="empty-state">No profiles submitted yet.</p>
          )}
        </div>
      </section>
    </>
  );
};

export default Form;
