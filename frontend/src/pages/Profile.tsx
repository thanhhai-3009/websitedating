import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Camera,
  MapPin,
  Verified,
  Edit3,
  LogOut,
  Shield,
  Bell,
  HelpCircle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ProfileState = {
  name: string;
  phone: string;
  birthday: string;
  age: number;
  gender: string;
  lookingFor: string;
  location: string;
  bio: string;
  photos: string[];
  interests: string[];
  verified: {
    email: boolean;
    phone: boolean;
    profile: boolean;
  };
};

const menuItems = [
  { icon: Edit3, label: "Edit Profile", href: "#edit" },
  { icon: Settings, label: "Account Settings", href: "#" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Shield, label: "Privacy & Safety", href: "#" },
  { icon: HelpCircle, label: "Help & Support", href: "#" },
];

const interestOptions = [
  "Travel", "Photography", "Music", "Movies", "Books", "Fitness",
  "Cooking", "Art", "Gaming", "Sports", "Nature", "Fashion",
  "Technology", "Dancing", "Yoga", "Coffee", "Wine", "Hiking",
];

const genderOptions = ["Man", "Woman", "Other"];
const lookingForOptions = ["Men", "Women", "Everyone"];

const EMPTY_PROFILE: ProfileState = {
  name: "",
  phone: "",
  birthday: "",
  age: 0,
  gender: "",
  lookingFor: "",
  location: "",
  bio: "",
  photos: [],
  interests: [],
  verified: {
    email: false,
    phone: false,
    profile: false,
  },
};

type ProfileApiResponse = {
  name?: string;
  phone?: string;
  birthday?: string;
  age?: number;
  gender?: string;
  lookingFor?: string;
  location?: string;
  bio?: string;
  photos?: string[];
  avatarUrl?: string;
  interests?: string[];
  emailVerified?: boolean;
  phoneVerified?: boolean;
  profileVerified?: boolean;
};

const getAgeFromBirthday = (birthday: string) => {
  if (!birthday) {
    return 0;
  }
  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDelta = now.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return Math.max(age, 0);
};

const getCompletionPercent = (profile: ProfileState) => {
  const checks = [
    profile.name.trim().length > 0,
    profile.birthday.trim().length > 0,
    profile.gender.trim().length > 0,
    profile.lookingFor.trim().length > 0,
    profile.location.trim().length > 0,
    profile.bio.trim().length >= 20,
    profile.interests.length >= 3,
    profile.photos.filter((photo) => Boolean(photo && photo.trim())).length >= 2,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
};

const splitName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

export default function Profile() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPhoneFormOpen, setIsPhoneFormOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedSlotRef = useRef(0);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const completionPercent = useMemo(() => getCompletionPercent(profile), [profile]);

  const normalizePhotos = (photos: string[] | undefined, avatarUrl: string | undefined) => {
    const cleaned = (photos || []).filter((value) => Boolean(value && value.trim()));
    if (cleaned.length > 0) {
      return cleaned.slice(0, 6);
    }
    if (avatarUrl && avatarUrl.trim()) {
      return [avatarUrl.trim()];
    }
    if (user?.imageUrl) {
      return [user.imageUrl];
    }
    return [];
  };

  const hydrateFromServer = (data: ProfileApiResponse) => {
    const nextPhotos = normalizePhotos(data.photos, data.avatarUrl);
    const birthday = data.birthday || "";
    const serverAge = typeof data.age === "number" ? data.age : 0;

    setProfile({
      name: data.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
      phone: data.phone || "",
      birthday,
      age: serverAge || getAgeFromBirthday(birthday),
      gender: data.gender || "",
      lookingFor: data.lookingFor || "",
      location: data.location || "",
      bio: data.bio || "",
      photos: nextPhotos,
      interests: data.interests || [],
      verified: {
        email: Boolean(data.emailVerified),
        phone: Boolean(data.phoneVerified),
        profile: Boolean(data.profileVerified),
      },
    });
  };

  const hydrateFromClerkFallback = () => {
    setProfile((prev) => ({
      ...prev,
      name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
      phone: "",
      photos: user?.imageUrl ? [user.imageUrl] : [],
      verified: {
        email: Boolean(user?.primaryEmailAddress?.emailAddress),
        phone: false,
        profile: false,
      },
    }));
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      try {
        const response = await fetch(`/api/users/profile/${user.id}`);
        if (!response.ok) {
          if (response.status === 404) {
            hydrateFromClerkFallback();
            return;
          }
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message || "Failed to load profile");
        }

        const data = (await response.json()) as ProfileApiResponse;
        hydrateFromServer(data);
      } catch (error) {
        hydrateFromClerkFallback();
        setErrorMessage(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  useEffect(() => {
    setPhoneInput(profile.phone || "");
  }, [profile.phone]);

  const saveProfile = async () => {
    if (!user?.id || !user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Missing account information",
        description: "Please sign in again and try one more time.",
        variant: "destructive",
      });
      return;
    }

    const { firstName, lastName } = splitName(profile.name);

    setIsSaving(true);
    setErrorMessage("");
    try {
      const payload = {
        clerkId: user.id,
        email: user.primaryEmailAddress.emailAddress,
        firstName,
        lastName,
        phone: profile.phone,
        imageUrl: profile.photos[0] || user.imageUrl || "",
        birthday: profile.birthday,
        gender: profile.gender,
        lookingFor: profile.lookingFor,
        location: profile.location,
        photos: profile.photos,
        interests: profile.interests,
        bio: profile.bio,
      };

      const response = await fetch("/api/users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Failed to save profile");
      }

      setProfile((prev) => ({
        ...prev,
        age: getAgeFromBirthday(prev.birthday),
        verified: {
          ...prev.verified,
          profile: true,
        },
      }));

      setIsEditing(false);
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile";
      setErrorMessage(message);
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const openPhotoPicker = (slotIndex: number) => {
    selectedSlotRef.current = slotIndex;
    photoInputRef.current?.click();
  };

  const removePhoto = (slotIndex: number) => {
    setProfile((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, index) => index !== slotIndex),
    }));
  };

  const onPhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid image", description: "Please choose an image file.", variant: "destructive" });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads/photos", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Photo upload failed");
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error("Photo URL was not returned");
      }

      const slotIndex = selectedSlotRef.current;
      setProfile((prev) => {
        const next = [...prev.photos];
        if (slotIndex < next.length) {
          next[slotIndex] = data.url;
        } else {
          next.push(data.url);
        }
        return {
          ...prev,
          photos: next.slice(0, 6),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photo upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((value) => value !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleLogout = async () => {
    await signOut(() => navigate("/login"));
  };

  const verifyPhone = async () => {
    if (!user?.id || !user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Missing account information",
        description: "Please sign in again and try one more time.",
        variant: "destructive",
      });
      return;
    }

    const cleaned = phoneInput.replace(/[\s()-]/g, "");
    if (!/^\+?[0-9]{8,15}$/.test(cleaned)) {
      toast({
        title: "Invalid phone",
        description: "Please enter a valid phone number (8-15 digits).",
        variant: "destructive",
      });
      return;
    }

    const { firstName, lastName } = splitName(profile.name);

    setIsSavingPhone(true);
    try {
      const payload = {
        clerkId: user.id,
        email: user.primaryEmailAddress.emailAddress,
        firstName,
        lastName,
        phone: cleaned,
        imageUrl: profile.photos[0] || user.imageUrl || "",
        birthday: profile.birthday,
        gender: profile.gender,
        lookingFor: profile.lookingFor,
        location: profile.location,
        photos: profile.photos,
        interests: profile.interests,
        bio: profile.bio,
      };

      const response = await fetch("/api/users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Failed to verify phone");
      }

      setProfile((prev) => ({
        ...prev,
        phone: cleaned,
        verified: {
          ...prev.verified,
          phone: true,
        },
      }));
      setIsPhoneFormOpen(false);
      toast({ title: "Phone verified", description: "Your phone has been added successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to verify phone";
      toast({ title: "Phone verification failed", description: message, variant: "destructive" });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const mainPhoto = profile.photos[0] || user?.imageUrl || "";

  return (
    <Layout isAuthenticated>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPhotoSelected}
          />

          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-3xl shadow-card p-6 mb-6"
          >
            {/* Main Photo */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              {mainPhoto ? (
                <img
                  src={mainPhoto}
                  alt={profile.name || "Profile"}
                  className="w-full h-full rounded-full object-cover ring-4 ring-coral-light"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-secondary ring-4 ring-coral-light" />
              )}
              <button
                type="button"
                onClick={() => openPhotoPicker(0)}
                disabled={isUploadingPhoto}
                className="absolute bottom-0 right-0 w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-md disabled:opacity-60"
              >
                <Camera className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>

            {/* Name & Info */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  {profile.name || "Your profile"}
                  {profile.age > 0 ? `, ${profile.age}` : ""}
                </h1>
                {profile.verified.email && (
                  <Verified className="w-5 h-5 text-blue-500 fill-blue-500" />
                )}
              </div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Button
                  variant={isEditing ? "outline" : "gradient"}
                  onClick={() => {
                    setIsEditing((prev) => {
                      const next = !prev;
                      if (next) {
                        setPhoneInput(profile.phone || "");
                        setIsPhoneFormOpen(true);
                      } else {
                        setIsPhoneFormOpen(false);
                      }
                      return next;
                    });
                  }}
                >
                  {isEditing ? "Cancel" : "Edit profile"}
                </Button>
                {isEditing && (
                  <Button variant="gradient" onClick={saveProfile} disabled={isSaving || isUploadingPhoto}>
                    {isSaving ? "Saving..." : "Save changes"}
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3 text-left">
                  <Input
                    value={profile.name}
                    onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Full name"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      type="date"
                      value={profile.birthday}
                      onChange={(event) => setProfile((prev) => ({
                        ...prev,
                        birthday: event.target.value,
                        age: getAgeFromBirthday(event.target.value),
                      }))}
                    />
                    <Input
                      value={profile.location}
                      onChange={(event) => setProfile((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <Input
                    value={profile.phone}
                    onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Phone number"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Gender</p>
                      <div className="grid grid-cols-3 gap-2">
                        {genderOptions.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={profile.gender === option ? "gradient" : "outline"}
                            onClick={() => setProfile((prev) => ({ ...prev, gender: option }))}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Looking for</p>
                      <div className="grid grid-cols-3 gap-2">
                        {lookingForOptions.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={profile.lookingFor === option ? "gradient" : "outline"}
                            onClick={() => setProfile((prev) => ({ ...prev, lookingFor: option }))}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Textarea
                    value={profile.bio}
                    onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
                    placeholder="Write your bio"
                    rows={4}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-muted-foreground mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.location || "Add your location"}</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-1 text-muted-foreground mt-1">
                {errorMessage ? (
                  <span className="text-destructive text-sm">{errorMessage}</span>
                ) : isLoading ? (
                  <span className="text-sm">Loading profile...</span>
                ) : null}
              </div>
            </div>

            {/* Profile Completion */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Profile completion</span>
                <span className="font-medium text-foreground">{completionPercent}%</span>
              </div>
              <Progress value={completionPercent} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Complete your profile to get more matches!
              </p>
            </div>

            {/* Photo Gallery */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {profile.photos.map((photo, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-xl overflow-hidden relative group"
                >
                  <img
                    src={photo}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30"
                      onClick={() => openPhotoPicker(i)}
                    >
                      <Edit3 className="w-5 h-5 text-white" />
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded bg-white/20 hover:bg-white/30 text-white"
                      onClick={() => removePhoto(i)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {profile.photos.length < 6 && (
                <button
                  type="button"
                  onClick={() => openPhotoPicker(profile.photos.length)}
                  className="aspect-[3/4] rounded-xl border-2 border-dashed border-border flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Bio */}
            <div className="mb-6">
              <h3 className="font-medium text-foreground mb-2">About me</h3>
              <p className="text-muted-foreground text-sm">
                {profile.bio || "Tell people a bit about yourself."}
              </p>
            </div>

            {/* Interests */}
            <div>
              <h3 className="font-medium text-foreground mb-2">Interests</h3>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {interestOptions.map((interest) => {
                    const active = profile.interests.includes(interest);
                    return (
                      <Button
                        key={interest}
                        variant={active ? "gradient" : "outline"}
                        size="sm"
                        onClick={() => toggleInterest(interest)}
                      >
                        {interest}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.length === 0 && (
                    <span className="text-sm text-muted-foreground">No interests added yet.</span>
                  )}
                  {profile.interests.map((interest) => (
                    <Badge key={interest} variant="secondary" className="rounded-full">
                      {interest}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Verification Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-3xl shadow-card p-6 mb-6"
          >
            <h2 className="font-serif text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Verification
            </h2>
            <div className="space-y-3">
              {Object.entries(profile.verified).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="capitalize text-foreground">{key} Verified</span>
                  {value ? (
                    <div className="flex items-center gap-2">
                      <Badge className="gradient-primary border-0">Verified</Badge>
                     
                    </div>
                  ) : (
                    <Button
                      variant="soft"
                      size="sm"
                      disabled={key !== "phone"}
                      onClick={() => {
                        if (key === "phone") {
                          setPhoneInput(profile.phone || "");
                          setIsPhoneFormOpen(true);
                        }
                      }}
                    >
                      Verify Now
                    </Button>
                  )}
                </div>
              ))}
              
            </div>
          </motion.div>

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-3xl shadow-card overflow-hidden mb-6"
          >
            {menuItems.map((item, i) => (
              <div key={item.label}>
                <button
                  type="button"
                  className="w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
                  onClick={() => {
                    if (item.href === "/notifications") {
                      navigate(item.href);
                    }
                    if (item.href === "#edit") {
                      setIsEditing(true);
                      setPhoneInput(profile.phone || "");
                      setIsPhoneFormOpen(true);
                    }
                  }}
                >
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <span className="flex-1 text-left text-foreground">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
                {i < menuItems.length - 1 && <Separator />}
              </div>
            ))}
          </motion.div>

          {/* Logout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              Log Out
            </Button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
