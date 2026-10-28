"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginScreen() {
  const login = useApp((s) => s.login);
  const pinConfigured = useApp((s) => s.pinConfigured);
  const initializeLocalAuth = useApp((s) => s.initializeLocalAuth);
  const setOwnerPin = useApp((s) => s.setOwnerPin);
  const navigate = useApp((s) => s.navigate);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    if (pin.length < 4) {
      setErr("PIN must be at least 4 digits");
      return;
    }
    if (setupMode || !pinConfigured) {
      if (pin !== confirmPin) {
        setErr("PINs do not match");
        return;
      }
      await setOwnerPin(pin);
      setSetupMode(false);
      setPin("");
      setConfirmPin("");
      setErr("PIN saved. Enter it to unlock.");
      return;
    }
    if (await login(pin)) {
      navigate("dashboard");
    } else {
      setErr("Wrong PIN");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-700 to-teal-900 flex flex-col items-center justify-center px-6 text-white">
      <div className="text-6xl mb-2">🔩</div>
      <h1 className="text-2xl font-extrabold tracking-tight">Hardware Shop</h1>
      <p className="text-teal-200 text-sm mt-1">Enter your PIN to unlock</p>

      <div className="w-full max-w-xs mt-8 space-y-3">
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handle()}
          placeholder="• • • •"
          className="bg-white/15 border-white/30 text-white text-center text-2xl tracking-[0.5em] placeholder:text-white/40 h-14"
        />
        {(setupMode || !pinConfigured) && (
          <Input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value);
              setErr("");
            }}
            placeholder="Confirm PIN"
            className="bg-white/15 border-white/30 text-white text-center text-xl tracking-[0.3em] placeholder:text-white/40 h-12"
          />
        )}
        {err && <p className="text-amber-300 text-sm text-center">{err}</p>}
        <Button
          onClick={handle}
          className="w-full bg-white text-teal-800 hover:bg-teal-50 font-extrabold h-12 text-base"
        >
          Unlock
        </Button>
        <p className="text-center text-teal-200/70 text-xs mt-2">
          {(!pinConfigured || setupMode) ? "Set your owner PIN on this device" : "Owner PIN"}
        </p>
        {pinConfigured && (
          <button
            type="button"
            onClick={() => {
              setSetupMode((value) => !value);
              setPin("");
              setConfirmPin("");
              setErr("");
            }}
            className="w-full text-xs text-teal-200 underline"
          >
            {setupMode ? "Cancel PIN change" : "Change PIN"}
          </button>
        )}
      </div>
    </div>
  );
}
