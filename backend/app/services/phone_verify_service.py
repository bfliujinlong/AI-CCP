import random
import time
from typing import Optional


class PhoneVerifyService:
    CODE_EXPIRE_SECONDS = 300
    CODE_LENGTH = 6
    _store: dict = {}

    def generate_code(self, phone: str) -> str:
        code = ''.join([str(random.randint(0, 9)) for _ in range(self.CODE_LENGTH)])
        self._store[phone] = {
            "code": code,
            "expires_at": time.time() + self.CODE_EXPIRE_SECONDS,
            "attempts": 0,
        }
        return code

    def verify_code(self, phone: str, code: str) -> bool:
        entry = self._store.get(phone)
        if not entry:
            return False
        if time.time() > entry["expires_at"]:
            del self._store[phone]
            return False
        entry["attempts"] += 1
        if entry["attempts"] > 5:
            del self._store[phone]
            return False
        if entry["code"] != code:
            return False
        del self._store[phone]
        return True

    def send_code(self, phone: str) -> dict:
        code = self.generate_code(phone)
        return {
            "phone": phone,
            "code_sent": True,
            "expires_in": self.CODE_EXPIRE_SECONDS,
            "message": f"验证码已发送至 {phone[:3]}****{phone[-4:]}",
            "debug_code": code,
        }


phone_verify_service = PhoneVerifyService()
