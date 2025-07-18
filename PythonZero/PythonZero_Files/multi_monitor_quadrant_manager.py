# Multi-Monitor Quadrant Window Manager
# Requirements: pip install pyqt5 pywin32 screeninfo

import sys
from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QHBoxLayout, QListWidget, QLabel, QFrame, QGridLayout, QGraphicsDropShadowEffect, QPushButton
from PyQt5.QtCore import Qt, QRect
from screeninfo import get_monitors
import win32gui
import win32con

# Helper to get all open windows

def enum_windows():
    windows = []
    def callback(hwnd, _):
        if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd):
            windows.append((hwnd, win32gui.GetWindowText(hwnd)))
    win32gui.EnumWindows(callback, None)
    return windows

class QuadrantFrame(QFrame):
    def __init__(self, quadrant_rect, parent=None):
        super().__init__(parent)
        self.setFrameShape(QFrame.Box)
        self.setAcceptDrops(True)
        self.quadrant_rect = quadrant_rect
        self.setStyleSheet('''
            QFrame {
                background-color: #1a1a1a;
                border-radius: 18px;
                border: 2px solid #b71c1c;
                box-shadow: 0 2px 16px #b71c1c40;
            }
            QFrame:hover {
                border: 2px solid #ff1744;
                box-shadow: 0 4px 32px #ff174440;
            }
        ''')

    def dragEnterEvent(self, event):
        if event.mimeData().hasText():
            event.acceptProposedAction()

    def dropEvent(self, event):
        hwnd = int(event.mimeData().text())
        x, y, w, h = self.quadrant_rect
        # Only adjust for top half positions
        # Detect if this is a top half by checking the height and y position
        # (Assume top half if y == monitor.y and h is about half the monitor height)
        # This logic works for horizontal halves and quadrant 1/2
        monitor_info = None
        # Try to get monitor info from quadrant_rect
        import screeninfo
        for m in screeninfo.get_monitors():
            if m.x <= x < m.x + m.width and m.y <= y < m.y + m.height:
                monitor_info = m
                break
        is_top_half = False
        if monitor_info:
            # Top half if y == monitor.y and h <= monitor.height//2 + 2
            if abs(y - monitor_info.y) < 2 and h <= monitor_info.height//2 + 2:
                is_top_half = True
        if is_top_half:
            import ctypes
            style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
            rect = [0, 0, w, h]
            class RECT(ctypes.Structure):
                _fields_ = [
                    ("left", ctypes.c_long),
                    ("top", ctypes.c_long),
                    ("right", ctypes.c_long),
                    ("bottom", ctypes.c_long)
                ]
            r = RECT(*rect)
            ctypes.windll.user32.AdjustWindowRect(ctypes.byref(r), style, False)
            adj_w = r.right - r.left
            adj_h = r.bottom - r.top

            # Get work area (excluding taskbar)
            wa_rect = RECT()
            SPI_GETWORKAREA = 0x0030
            ctypes.windll.user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(wa_rect), 0)
            # If the top half would overlap the taskbar, shrink it
            # Only adjust height if the monitor's bottom is below the work area
            if (y + adj_h) > wa_rect.bottom:
                adj_h = wa_rect.bottom - y
                if adj_h < 0:
                    adj_h = h  # fallback
            win32gui.SetWindowPos(hwnd, win32con.HWND_TOP, x, y, adj_w, adj_h, win32con.SWP_SHOWWINDOW)
        else:
            win32gui.SetWindowPos(hwnd, win32con.HWND_TOP, x, y, w, h, win32con.SWP_SHOWWINDOW)
        event.acceptProposedAction()

class MonitorWindow(QWidget):
    def __init__(self, monitor, windows):
        super().__init__()
        self.setWindowTitle(f'Monitor {monitor.name}')
        self.setGeometry(monitor.x, monitor.y, monitor.width, monitor.height)
        layout = QHBoxLayout(self)

        # List of open windows
        self.list_widget = QListWidget()
        for hwnd, title in windows:
            self.list_widget.addItem(f'{title} ({hwnd})')
        self.list_widget.setDragEnabled(True)
        layout.addWidget(self.list_widget, 1)

        # Quadrants
        quad_layout = QVBoxLayout()
        quad_frames = []
        quad_rects = self.get_quadrant_rects(monitor)
        # Use small visual frames for quadrants
        for i in range(2):
            row = QHBoxLayout()
            for j in range(2):
                idx = i*2 + j
                frame = QuadrantFrame(quad_rects[idx])
                frame.setFixedSize(100, 80)
                label = QLabel(f'Quadrant {idx+1}')
                label.setAlignment(Qt.AlignCenter)
                frame_layout = QVBoxLayout(frame)
                frame_layout.addWidget(label)
                row.addWidget(frame)
                quad_frames.append(frame)
            quad_layout.addLayout(row)
        layout.addLayout(quad_layout, 3)

        self.list_widget.mouseMoveEvent = self.startDrag
        self.windows = windows

    def get_quadrant_rects(self, monitor):
        w, h = monitor.width, monitor.height
        x, y = monitor.x, monitor.y
        return [
            (x, y, w//2, h//2),
            (x+w//2, y, w//2, h//2),
            (x, y+h//2, w//2, h//2),
            (x+w//2, y+h//2, w//2, h//2)
        ]

    def startDrag(self, event):
        item = self.list_widget.currentItem()
        if item:
            import PyQt5.QtCore
            drag = PyQt5.QtGui.QDrag(self.list_widget)
            mime = PyQt5.QtCore.QMimeData()
            # Extract hwnd from item text
            hwnd = item.text().split('(')[-1].replace(')','')
            mime.setText(hwnd)
            drag.setMimeData(mime)
            drag.exec_(Qt.MoveAction)

if __name__ == '__main__':
    app = QApplication(sys.argv)
    windows = enum_windows()
    monitors = get_monitors()

    from PyQt5.QtWidgets import QScrollArea, QGroupBox

    class AllMonitorsWindow(QWidget):
        def __init__(self, monitors, windows):
            super().__init__()
            self.setWindowTitle('Quadrant Manager - All Monitors')
            self.setGeometry(100, 100, 1100, 900)
            self.setWindowFlags(Qt.FramelessWindowHint | Qt.Window)
            self.setAttribute(Qt.WA_TranslucentBackground)
            shadow = QGraphicsDropShadowEffect(self)
            shadow.setBlurRadius(40)
            shadow.setColor(Qt.red)
            shadow.setOffset(0, 0)
            self.setGraphicsEffect(shadow)
            self.dragPos = None
            self.setStyleSheet('''
                QWidget#MainBg {
                    background-color: #181a1a;
                    border-radius: 32px;
                    border: 3px solid #b71c1c;
                }
                QPushButton#TitleBtn {
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 22px;
                    padding: 0 8px;
                }
                QPushButton#TitleBtn:hover {
                    color: #ff1744;
                }
                #TitleBar {
                    background: #181a1a;
                    border-top-left-radius: 32px;
                    border-top-right-radius: 32px;
                }
                QListWidget {
                    background-color: #1a1a1a;
                    border-radius: 14px;
                    color: #fff;
                    font-size: 17px;
                    border: 2px solid #b71c1c;
                    padding: 10px;
                    box-shadow: 0 2px 12px #b71c1c40;
                }
                QListWidget::item {
                    padding: 12px 10px;
                    border-radius: 10px;
                }
                QListWidget::item:selected {
                    background: #b71c1c;
                    color: #fff;
                }
                QListWidget::item:hover {
                    background: #ff1744;
                    color: #fff;
                }
                QGroupBox {
                    border: none;
                    margin-top: 12px;
                    font-weight: 700;
                    font-size: 18px;
                    color: #fff;
                    background: transparent;
                    padding: 0;
                }
                QLabel {
                    font-size: 16px;
                    color: #fff;
                    font-weight: 600;
                    letter-spacing: 1px;
                }
            ''')
            main_bg = QWidget(self)
            main_bg.setObjectName('MainBg')
            main_bg.setGeometry(0, 0, 1100, 900)
            main_layout = QVBoxLayout(main_bg)
            main_layout.setContentsMargins(0, 0, 0, 0)
            # Title bar
            title_bar = QWidget()
            title_bar.setObjectName('TitleBar')
            title_layout = QHBoxLayout(title_bar)
            title_layout.setContentsMargins(16, 8, 16, 8)
            title_layout.setSpacing(0)
            title_label = QLabel('Quadrant Manager')
            title_label.setStyleSheet('font-size: 22px; font-weight: bold; color: #fff;')
            title_layout.addWidget(title_label)
            title_layout.addStretch(1)
            btn_min = QPushButton('_')
            btn_min.setObjectName('TitleBtn')
            btn_min.setFixedSize(32, 32)
            btn_min.clicked.connect(self.showMinimized)
            title_layout.addWidget(btn_min)
            btn_exit = QPushButton('×')
            btn_exit.setObjectName('TitleBtn')
            btn_exit.setFixedSize(32, 32)
            btn_exit.clicked.connect(self.close)
            title_layout.addWidget(btn_exit)
            main_layout.addWidget(title_bar)
            # Main content layout
            content_layout = QHBoxLayout()
            content_layout.setContentsMargins(32, 16, 32, 32)
            # List of open windows
            self.list_widget = QListWidget()
            for hwnd, title in windows:
                self.list_widget.addItem(f'{title} ({hwnd})')
            self.list_widget.setDragEnabled(True)
            self.list_widget.setMinimumWidth(220)
            self.list_widget.setMaximumWidth(260)
            self.list_widget.setStyleSheet('QListWidget::item { padding: 8px; }')
            content_layout.addWidget(self.list_widget, 1)
            # Scrollable area for all monitors
            scroll = QScrollArea()
            scroll.setWidgetResizable(True)
            monitors_widget = QWidget()
            # Use grid layout for better space utilization
            monitors_grid = QGridLayout(monitors_widget)
            monitors_grid.setSpacing(18)
            monitors_grid.setContentsMargins(0, 0, 0, 0)
            # Place monitors in grid (2 columns)
            col_count = 2 if len(monitors) > 1 else 1
            monitor_frame_size = (220, 220)
            halves_frame_size = (220, 220)
            for idx, monitor in enumerate(monitors):
                group = QGroupBox(f'Monitor: {monitor.name} ({monitor.width}x{monitor.height})')
                group_layout = QVBoxLayout(group)
                # Quadrant monitor representation
                monitor_frame = QFrame()
                monitor_frame.setFrameShape(QFrame.NoFrame)
                monitor_frame.setFixedSize(*monitor_frame_size)
                monitor_frame.setStyleSheet('''
                    QFrame {
                        background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                            stop:0 #222, stop:0.5 #333, stop:1 #111);
                        border-radius: 16px;
                        border: 4px solid #b71c1c;
                        box-shadow: 0 8px 32px #b71c1c60;
                    }
                ''')
                monitor_grid = QGridLayout(monitor_frame)
                monitor_grid.setContentsMargins(16, 16, 16, 16)
                monitor_grid.setSpacing(12)
                # Unified gradient colors for quadrants
                quadrant_gradients = [
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #b71c1c, stop:0.5 #ff1744, stop:1 #c62828)',
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #b71c1c, stop:0.5 #d32f2f, stop:1 #ff1744)',
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #c62828, stop:0.5 #b71c1c, stop:1 #ff1744)',
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #d32f2f, stop:0.5 #b71c1c, stop:1 #c62828)'
                ]
                quad_rects = [
                    (monitor.x, monitor.y, monitor.width//2, monitor.height//2),
                    (monitor.x+monitor.width//2, monitor.y, monitor.width//2, monitor.height//2),
                    (monitor.x, monitor.y+monitor.height//2, monitor.width//2, monitor.height//2),
                    (monitor.x+monitor.width//2, monitor.y+monitor.height//2, monitor.width//2, monitor.height//2)
                ]
                for qidx in range(4):
                    frame = QuadrantFrame(quad_rects[qidx])
                    frame.setFixedSize(90, 90)
                    frame.setStyleSheet(f"""
                        QFrame {{
                            background: {quadrant_gradients[qidx]};
                            border-radius: 12px;
                            border: 2px solid #b71c1c;
                            box-shadow: 0 4px 16px #b71c1c80, 0 1px 0 #fff4 inset;
                            transition: box-shadow 0.2s, border 0.2s;
                        }}
                        QFrame:hover {{
                            border: 2px solid #ff1744;
                            box-shadow: 0 8px 32px #ff174480, 0 1px 0 #fff8 inset;
                            background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                                stop:0 #ff1744, stop:0.5 #b71c1c, stop:1 #c62828);
                        }}
                    """)
                    label = QLabel(f'Q{qidx+1}')
                    label.setAlignment(Qt.AlignCenter)
                    label.setStyleSheet('font-weight: bold; font-size: 16px; color: #fff;')
                    frame_layout = QVBoxLayout(frame)
                    frame_layout.addWidget(label)
                    monitor_grid.addWidget(frame, qidx//2, qidx%2)
                group_layout.addWidget(monitor_frame)
                # Vertical halves representation (perfect square, large)
                vframe = QFrame()
                vframe.setFrameShape(QFrame.NoFrame)
                vframe.setFixedSize(*halves_frame_size)
                vframe.setStyleSheet('''
                    QFrame {
                        background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                            stop:0 #222, stop:1 #111);
                        border-radius: 12px;
                        border: 2px solid #b71c1c;
                    }
                ''')
                vgrid = QHBoxLayout(vframe)
                vgrid.setContentsMargins(16, 16, 16, 16)
                vgrid.setSpacing(12)
                vgradients = [
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #b71c1c, stop:1 #ff1744)',
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #ff1744, stop:1 #b71c1c)'
                ]
                vrects = [
                    (monitor.x, monitor.y, monitor.width//2, monitor.height),
                    (monitor.x+monitor.width//2, monitor.y, monitor.width//2, monitor.height)
                ]
                for vidx in range(2):
                    frame = QuadrantFrame(vrects[vidx])
                    frame.setFixedSize(90, 90)
                    frame.setStyleSheet(f"""
                        QFrame {{
                            background: {vgradients[vidx]};
                            border-radius: 12px;
                            border: 2px solid #b71c1c;
                            box-shadow: 0 4px 16px #b71c1c80, 0 1px 0 #fff4 inset;
                            transition: box-shadow 0.2s, border 0.2s;
                        }}
                        QFrame:hover {{
                            border: 2px solid #ff1744;
                            box-shadow: 0 8px 32px #ff174480, 0 1px 0 #fff8 inset;
                            background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                                stop:0 #ff1744, stop:1 #b71c1c);
                        }}
                    """)
                    label = QLabel('L' if vidx==0 else 'R')
                    label.setAlignment(Qt.AlignCenter)
                    label.setStyleSheet('font-weight: bold; font-size: 16px; color: #fff;')
                    frame_layout = QVBoxLayout(frame)
                    frame_layout.addWidget(label)
                    vgrid.addWidget(frame)
                group_layout.addWidget(vframe)
                # Horizontal halves representation (perfect square, large)
                hframe = QFrame()
                hframe.setFrameShape(QFrame.NoFrame)
                hframe.setFixedSize(*halves_frame_size)
                hframe.setStyleSheet('''
                    QFrame {
                        background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                            stop:0 #222, stop:1 #111);
                        border-radius: 12px;
                        border: 2px solid #b71c1c;
                    }
                ''')
                hgrid = QVBoxLayout(hframe)
                hgrid.setContentsMargins(16, 16, 16, 16)
                hgrid.setSpacing(12)
                hgradients = [
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #c62828, stop:1 #b71c1c)',
                    'qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #d32f2f, stop:1 #b71c1c)'
                ]
                half = monitor.height / 2.0
                top_height = int(round(half))
                bottom_height = monitor.height - top_height
                hrects = [
                    (monitor.x, monitor.y, monitor.width, top_height),
                    (monitor.x, monitor.y+top_height, monitor.width, bottom_height)
                ]
                for hidx in range(2):
                    frame = QuadrantFrame(hrects[hidx])
                    frame.setFixedSize(90, 90)
                    frame.setStyleSheet(f"""
                        QFrame {{
                            background: {hgradients[hidx]};
                            border-radius: 12px;
                            border: 2px solid #b71c1c;
                            box-shadow: 0 4px 16px #b71c1c80, 0 1px 0 #fff4 inset;
                            transition: box-shadow 0.2s, border 0.2s;
                        }}
                        QFrame:hover {{
                            border: 2px solid #ff1744;
                            box-shadow: 0 8px 32px #ff174480, 0 1px 0 #fff8 inset;
                            background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                                stop:0 #ff1744, stop:1 #b71c1c);
                        }}
                    """)
                    label = QLabel('T' if hidx==0 else 'B')
                    label.setAlignment(Qt.AlignCenter)
                    label.setStyleSheet('font-weight: bold; font-size: 16px; color: #fff;')
                    frame_layout = QVBoxLayout(frame)
                    frame_layout.addWidget(label)
                    hgrid.addWidget(frame)
                group_layout.addWidget(hframe)
                monitors_grid.addWidget(group, idx//col_count, idx%col_count)
            scroll.setWidget(monitors_widget)
            content_layout.addWidget(scroll, 3)
            main_layout.addLayout(content_layout)
            self.list_widget.mouseMoveEvent = self.startDrag
            self.windows = windows
        # Window dragging
        def mousePressEvent(self, event):
            if event.button() == Qt.LeftButton:
                self.dragPos = event.globalPos()
                event.accept()
        def mouseMoveEvent(self, event):
            if event.buttons() == Qt.LeftButton and self.dragPos:
                self.move(self.pos() + event.globalPos() - self.dragPos)
                self.dragPos = event.globalPos()
                event.accept()
        def mouseReleaseEvent(self, event):
            self.dragPos = None
            event.accept()
        # Drag-and-drop for window list
        def startDrag(self, event):
            item = self.list_widget.currentItem()
            if item:
                import PyQt5.QtCore
                drag = PyQt5.QtGui.QDrag(self.list_widget)
                mime = PyQt5.QtCore.QMimeData()
                hwnd = item.text().split('(')[-1].replace(')','')
                mime.setText(hwnd)
                drag.setMimeData(mime)
                drag.exec_(Qt.MoveAction)

    win = AllMonitorsWindow(monitors, windows)
    win.show()
    sys.exit(app.exec_())
