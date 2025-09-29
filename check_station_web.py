import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import requests
from datetime import datetime, timedelta, timezone
import pytz
import time

# --- Retry Wrapper ---
def safe_get(url, max_retries=5, delay=5):
    for attempt in range(max_retries):
        try:
            response = requests.get(url)
            response.raise_for_status()
            return response
        except Exception as e:
            time.sleep(delay)
    return None

# Setup
station = "BOU"
element = "F"
sampling_period = 60
variation_limit = 2.0  # in nT
gmt_minus_6 = pytz.timezone("Etc/GMT+6")

# Time
end_time = datetime.now(timezone.utc)
start_f_time = end_time - timedelta(hours=1)
start_kp_time = end_time - timedelta(hours=9)

# Title
st.title("1Go / No-Go Geomagnetic Monitor")
st.markdown("Displays 1-minute geomagnetic field variations (F) and Kp index readings.")

# --- Get F Data ---
usgs_url = (
    f"https://geomag.usgs.gov/ws/data/?id={station}"
    f"&elements={element}&sampling_period={sampling_period}"
    f"&starttime={start_f_time.isoformat()}&endtime={end_time.isoformat()}&format=json"
)
usgs_response = safe_get(usgs_url)
if not usgs_response:
    st.error("Failed to fetch USGS F data.")
    st.stop()

usgs_data = usgs_response.json()
times_utc = pd.to_datetime(usgs_data.get("times", []))
f_values = usgs_data.get("values", [])[0].get("values", [])
df = pd.DataFrame({"timestamp": times_utc, "F": f_values})
df = df.dropna()
df['F'] = pd.to_numeric(df['F'], errors='coerce')
df['F_diff'] = df['F'].diff()
df['Exceeds_2nT'] = df['F_diff'].abs() > variation_limit
df['timestamp_local'] = df['timestamp'].dt.tz_convert(gmt_minus_6)
variation_ok = not df['Exceeds_2nT'].any()

# --- Get Kp Data ---
kp_txt_url = "https://services.swpc.noaa.gov/text/daily-geomagnetic-indices.txt"
kp_response = safe_get(kp_txt_url)
if not kp_response:
    st.error("Failed to fetch NOAA Kp data.")
    st.stop()

lines = kp_response.text.strip().split("\n")
today_str = end_time.strftime("%Y %m %d")
kp_line = next((line for line in lines if line.startswith(today_str)), None)

kp_values, kp_times = [], []
if kp_line:
    parts = kp_line.strip().split()
    midnight = datetime(end_time.year, end_time.month, end_time.day, tzinfo=timezone.utc)
    for i, kp_str in enumerate(parts[-8:]):
        try:
            kp_val = float(kp_str)
            if kp_val != -1.00:
                block_time = midnight + timedelta(hours=i * 3)
                # 👉 keep UTC time
                kp_times.append(block_time)
                kp_values.append(kp_val)
        except ValueError:
            continue

if len(kp_times) >= 3:
    kp_df = pd.DataFrame({"time": kp_times[-3:], "kp": kp_values[-3:]})
else:
    kp_df = pd.DataFrame({"time": kp_times, "kp": kp_values})

kp_ok = kp_df['kp'].iloc[-1] <= 4


# --- Plots ---
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), sharex=False)

# ∆F plot
ax1.plot(df['timestamp_local'], df['F_diff'], label='∆F 1-min', color='blue', marker='o', markersize=3)
ax1.axhline(variation_limit, color='gray', linestyle='--')
ax1.axhline(-variation_limit, color='gray', linestyle='--')
ax1.set_ylabel('∆F (nT)')
ax1.set_title('1-Minute ∆F Variation (Last Hour, GMT-6)')
ax1.grid(True)

# Kp plot
x_pos = range(len(kp_df))
colors = ['limegreen' if k <= 4 else 'crimson' for k in kp_df['kp']]
ax2.bar(x_pos, kp_df['kp'], color=colors)

for x, value in zip(x_pos, kp_df['kp']):
    ax2.text(x, value + 0.2, str(value), ha='center', fontsize=10)

ax2.axhline(4, color='gray', linestyle='--')
ax2.set_xticks(x_pos)
ax2.set_xticklabels(kp_df['time'].dt.strftime('%H:%M UTC'))  # 👈 label as UTC
ax2.set_ylabel('Kp Index')
ax2.set_title('Kp Index (Last 9 Hours, UTC)')  # 👈 update title
ax2.set_ylim(0, 9)
ax2.grid(True, axis='y')


st.pyplot(fig)

# --- Summary ---
go_status = "✅ GO" if variation_ok and kp_ok else "❌ NO-GO"
box_color = "green" if "GO" in go_status else "red"
st.markdown(f"<h2 style='color:{box_color}'>{go_status}</h2>", unsafe_allow_html=True)
st.write("Status details:")
st.write("- ∆F variation OK" if variation_ok else "- ⚠️ ∆F variation exceeded ±2 nT")
st.write("- Kp index OK" if kp_ok else "- ⚠️ Kp index > 4")

