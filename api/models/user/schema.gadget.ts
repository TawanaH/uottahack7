import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "user" model, go to https://cusched.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "De6Ue7cCJPkz",
  fields: {
    email: {
      type: "email",
      validations: { required: true, unique: true },
      storageKey: "bwwtbVzC0c0u",
    },
    emailVerificationToken: {
      type: "string",
      storageKey: "b3HMFqDYfNkc",
    },
    emailVerificationTokenExpiration: {
      type: "dateTime",
      includeTime: true,
      storageKey: "5bMky1I5zamx",
    },
    emailVerified: {
      type: "boolean",
      default: false,
      storageKey: "3gm-rcWQa-dN",
    },
    firstName: { type: "string", storageKey: "n4Ju54i_91xE" },
    googleImageUrl: { type: "url", storageKey: "RVKaiDTWFne9" },
    googleProfileId: { type: "string", storageKey: "fD1AAEHLyrBS" },
    lastName: { type: "string", storageKey: "AEKYegkAcgZ4" },
    lastSignedIn: {
      type: "dateTime",
      includeTime: true,
      storageKey: "J3ol7xLpy0-8",
    },
    password: {
      type: "password",
      validations: { strongPassword: true },
      storageKey: "_sL-iOOq0z05",
    },
    resetPasswordToken: {
      type: "string",
      storageKey: "KVqyKCbDma9E",
    },
    resetPasswordTokenExpiration: {
      type: "dateTime",
      includeTime: true,
      storageKey: "pD4p5Gvt8p9F",
    },
    roles: {
      type: "roleList",
      default: ["unauthenticated"],
      storageKey: "MY1hO5vYVc5S",
    },
  },
};
