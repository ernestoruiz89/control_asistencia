import os
import uuid
import tkinter as tk
from tkinter import messagebox
import requests
import json
from datetime import datetime
from dotenv import load_dotenv, set_key

# --- CONFIGURACIÓN DE RUTA ---
ENV_PATH = ".env"

def ensure_env_exists():
    """Crea el archivo .env con valores por defecto si no existe."""
    if not os.path.exists(ENV_PATH):
        try:
            with open(ENV_PATH, "w", encoding="utf-8") as f:
                f.write("ERP_URL=https://tu-instancia.com\n")
                f.write("API_KEY=tu_api_key\n")
                f.write("API_SECRET=tu_api_secret\n")
                f.write("EMPLOYEE_ID=\n")
                f.write("DEFAULT_LATITUDE=12.1261\n")
                f.write("DEFAULT_LONGITUDE=-86.2660\n")
            print("Archivo .env creado automáticamente.")
        except Exception as e:
            print(f"No se pudo crear el archivo .env: {e}")

# Ejecutar verificación antes de cargar variables
ensure_env_exists()
load_dotenv(ENV_PATH)

# Cargar variables de entorno
URL_BASE = os.getenv("ERP_URL")
API_KEY = os.getenv("API_KEY")
API_SECRET = os.getenv("API_SECRET")
EMPLOYEE_ID = os.getenv("EMPLOYEE_ID")

HEADERS = {
    "Authorization": f"token {API_KEY}:{API_SECRET}",
    "Content-Type": "application/json"
}

def get_mac_address():
    """Obtiene la dirección MAC del equipo para validación de seguridad."""
    return ':'.join(['{:02x}'.format((uuid.getnode() >> ele) & 0xff) for ele in range(0, 8*6, 8)][::-1])

class AttendanceApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Asistencia")
        self.root.geometry("400x520")
        self.root.resizable(False, False)
        self.root.configure(bg="#f4f6f9")
        
        try:
            # Asegúrate de tener el archivo icon.ico o cambia el nombre aquí
            self.root.iconbitmap('icon.ico')
        except Exception:
            pass
        
        self.current_mac = get_mac_address()
        self.emp_id = os.getenv("EMPLOYEE_ID") # Re-leer del entorno
        
        self.emp_full_name = tk.StringVar(value="Buscando empleado...")
        self.status_text = tk.StringVar(value="Sincronizando...")
        self.notif_text = tk.StringVar(value="") 
        
        self.btns = {}

        # Lógica de inicio: si no hay ID, ir a enrolamiento
        if not self.emp_id:
            self.show_enrollment_screen()
        else:
            self.show_attendance_screen()
            self.fetch_employee_name()

    def show_enrollment_screen(self):
        self.clear_screen()
        tk.Label(self.root, text="VINCULACIÓN DE TERMINAL", font=("Arial", 12, "bold"), bg="#f4f6f9").pack(pady=20)
        tk.Label(self.root, text="Ingrese su Identificación:", bg="#f4f6f9").pack()
        
        self.ent_ident = tk.Entry(self.root, font=("Arial", 12), justify="center")
        self.ent_ident.pack(pady=10)
        
        tk.Button(self.root, text="Vincular Equipo", bg="#17a2b8", fg="white", 
                  font=("Arial", 10, "bold"), height=2, width=25, relief="flat",
                  command=self.process_enrollment).pack(pady=10)

    def _extract_error(self, res):
        try:
            data = res.json()
            if "exception" in data:
                return data["exception"].split(":", 1)[-1].strip()
            if "_server_messages" in data:
                import json
                msgs = json.loads(data["_server_messages"])
                return json.loads(msgs[0]).get("message", res.text)
        except Exception:
            pass
        return res.text

    def process_enrollment(self):
        ident = self.ent_ident.get().strip()
        if not ident: return
        try:
            payload = {"identificacion": ident, "mac_address": self.current_mac}
            res = requests.post(f"{URL_BASE}/api/method/control_asistencia.control_asistencia.functions.get_employee_and_enroll", 
                               headers=HEADERS, json=payload, timeout=10)
            
            if res.status_code == 200:
                data = res.json()["message"]
                if messagebox.askyesno("Confirmar", f"¿Eres {data['employee_name']}?"):
                    set_key(ENV_PATH, "EMPLOYEE_ID", data["employee_id"])
                    # Forzar recarga de variables tras escribir en el archivo
                    os.environ["EMPLOYEE_ID"] = data["employee_id"]
                    self.emp_id = data["employee_id"]
                    self.emp_full_name.set(data['employee_name'])
                    self.show_attendance_screen()
            else:
                err_msg = self._extract_error(res)
                messagebox.showerror("Error", err_msg)
        except Exception as e:
            messagebox.showerror("Error de Conexión", str(e))

    def show_attendance_screen(self):
        self.clear_screen()
        
        tk.Label(self.root, text="BIENVENIDO(A)", font=("Arial", 9), bg="#f4f6f9", fg="#7f8c8d").pack(pady=(20, 0))
        tk.Label(self.root, textvariable=self.emp_full_name, font=("Arial", 14, "bold"), 
                 bg="#f4f6f9", fg="#2c3e50", wraplength=350, justify="center").pack(pady=(0, 10))
        
        tk.Label(self.root, text=f"ID: {self.emp_id}", font=("Arial", 8), bg="#f4f6f9", fg="#bdc3c7").pack()
        tk.Label(self.root, textvariable=self.status_text, font=("Arial", 10, "italic"), bg="#f4f6f9", fg="#546e7a").pack(pady=10)

        self.lbl_notif = tk.Label(self.root, textvariable=self.notif_text, font=("Arial", 11, "bold"), bg="#f4f6f9")
        self.lbl_notif.pack(pady=10)

        self.btns["clock-in"] = tk.Button(self.root, text="REGISTRAR ENTRADA", bg="#17a2b8", fg="white", 
                                         font=("Arial", 11, "bold"), height=3, width=25, relief="flat",
                                         disabledforeground="#f0f0f0",
                                         command=lambda: self.register("IN", "clock-in"))
        self.btns["clock-in"].pack(pady=10)
        self.btns["clock-in"].orig_col = "#17a2b8"

        self.btns["clock-out"] = tk.Button(self.root, text="REGISTRAR SALIDA", bg="#dc3545", fg="white", 
                                          font=("Arial", 11, "bold"), height=3, width=25, relief="flat",
                                          disabledforeground="#f0f0f0",
                                          command=lambda: self.register("OUT", "clock-out"))
        self.btns["clock-out"].pack(pady=10)
        self.btns["clock-out"].orig_col = "#dc3545"

        self.refresh_ui_state()

    def fetch_employee_name(self):
        try:
            res = requests.get(f"{URL_BASE}/api/resource/Employee/{self.emp_id}", headers=HEADERS, timeout=10)
            if res.status_code == 200:
                name = res.json().get("data", {}).get("employee_name", "Usuario")
                self.emp_full_name.set(name)
        except Exception:
            self.emp_full_name.set("Modo Offline")

    def show_notif(self, message, color, duration=4000):
        self.notif_text.set(message)
        if hasattr(self, 'lbl_notif'): self.lbl_notif.config(fg=color)
        self.root.after(duration, lambda: self.notif_text.set(""))

    def refresh_ui_state(self):
        try:
            payload = {"client_timezone": "America/Managua"}
            res = requests.post(f"{URL_BASE}/api/method/control_asistencia.control_asistencia.functions.get_current_status", 
                               headers=HEADERS, json=payload, timeout=10)
            
            if res.status_code == 200:
                data = res.json().get("message", {})
                last_action = data.get("last_action")

                for b in self.btns.values():
                    b.config(state="disabled", bg="#dcdcdc")

                if last_action == "clock-in":
                    self.status_text.set("Estado: Laborando")
                    self.btns["clock-out"].config(state="normal", bg=self.btns["clock-out"].orig_col)
                else:
                    self.status_text.set("Estado: Fuera de Turno")
                    self.btns["clock-in"].config(state="normal", bg=self.btns["clock-in"].orig_col)
        except Exception:
            self.status_text.set("Error de sincronización")

    def register(self, log_type, label):
        for b in self.btns.values(): b.config(state="disabled")
        self.notif_text.set("Procesando...")

        payload = {
            "log_type": log_type,
            "custom_registration_type": label,
            "latitude": float(os.getenv("DEFAULT_LATITUDE", 12.1261)),
            "longitude": float(os.getenv("DEFAULT_LONGITUDE", -86.2660)),
            "client_timezone": "America/Managua",
            "device_id": self.current_mac
        }
        
        try:
            url = f"{URL_BASE}/api/method/control_asistencia.control_asistencia.functions.register_checkin"
            res = requests.post(url, headers=HEADERS, json=payload, timeout=10)
            
            if res.status_code == 200:
                self.show_notif(f"¡EXITOSO!", "#2e7d32")
                self.refresh_ui_state()
            else:
                err_msg = self._extract_error(res)
                messagebox.showerror("Error de Registro", err_msg)
                self.refresh_ui_state()
        except Exception as e:
            messagebox.showerror("Error Crítico", str(e))
            self.refresh_ui_state()

    def clear_screen(self):
        for widget in self.root.winfo_children():
            widget.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = AttendanceApp(root)
    root.mainloop()