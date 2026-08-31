import { useEffect, useState, useRef } from "react";
import Icon from "../Icon";
import { _setToastFn } from "../utils/toast";

export default function ToastHost() {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    _setToastFn((msg, type = "success") => {
      setToast({ msg, type, key: Date.now() });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setToast(null), 2200);
    });

    return () => {
      _setToastFn(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`} key={toast.key}>
      <Icon name={toast.type==="success"?"checkCircle":"xCircle"} size={16}/>
      {toast.msg}
    </div>
  );
}
