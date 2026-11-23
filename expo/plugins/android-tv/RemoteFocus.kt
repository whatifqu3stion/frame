package studio.frame.tv

import android.animation.ValueAnimator
import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.Rect
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Build
import android.provider.Settings
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.webkit.WebView
import android.widget.EditText
import android.widget.TextView
import android.widget.CompoundButton
import com.horcrux.svg.SvgView
import java.lang.ref.WeakReference
import com.facebook.react.views.modal.ReactModalHostView
import kotlin.math.roundToInt

/** Paint remote feedback inside the window that actually owns focus, including React sheets. */
object RemoteFocus {
    private const val PALETTE_PREFIX = "frame-tv-palette:"
    private val fillLayerId = View.generateViewId()
    private var paletteView = WeakReference<View>(null)
    private fun reactId(view: View) = view.getTag(com.facebook.react.R.id.view_tag_native_id) as? String

    fun install(activity: Activity) {
        val mode = activity.resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK
        if (mode == Configuration.UI_MODE_TYPE_TELEVISION) attach(activity.window)
    }

    private fun attach(window: Window) {
        val original = window.callback ?: return
        if (original is ControlFeedback) return
        val feedback = ControlFeedback(window, original)
        window.callback = feedback
        feedback.observe()
    }

    private class ControlFeedback(window: Window, private val original: Window.Callback) : Window.Callback by original {
        private val root = window.decorView as ViewGroup
        private fun dp(value: Int) = (value * root.resources.displayMetrics.density).roundToInt()
        private var accent = Color.rgb(59, 96, 115)
        private var foreground = Color.rgb(255, 253, 249)
        private var paletteId: String? = null
        private var surface: View? = null
        private var backing: Drawable? = null
        private var fill: GradientDrawable? = null
        private val inked = mutableListOf<View>()
        private var nativeHint: GradientDrawable? = null
        private val previousBounds = Rect()
        private val location = IntArray(2)
        private var hovered: View? = null
        private var painted: View? = null
        private var pressure = 0
        private var motion: ValueAnimator? = null

        fun observe() {
            root.viewTreeObserver.addOnPreDrawListener { paint(); true }
            root.viewTreeObserver.addOnGlobalFocusChangeListener { _, _ -> root.invalidate() }
            // React Native presents a Sheet in a second Android window. Discover it on
            // layout/window changes, never by polling the view hierarchy at frame rate.
            root.viewTreeObserver.addOnGlobalLayoutListener { findSheets(root) }
            root.viewTreeObserver.addOnWindowFocusChangeListener { focused ->
                hovered = null
                if (!focused) {
                    motion?.cancel()
                    clearFocusPaint()
                    root.invalidate()
                }
                root.post { findSheets(root); root.invalidate() }
            }
        }

        private fun findSheets(view: View) {
            if (reactId(view)?.startsWith(PALETTE_PREFIX) == true && paletteView.get() !== view) paletteView = WeakReference(view)
            if (view is ReactModalHostView) { view.dialog?.window?.let { attach(it) }; return }
            if (view is ViewGroup) for (index in 0 until view.childCount) findSheets(view.getChildAt(index))
        }

        private fun animates() = if (Build.VERSION.SDK_INT >= 26) ValueAnimator.areAnimatorsEnabled()
            else Settings.Global.getFloat(root.context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
        private fun setPressure(amount: Int) {
            pressure = amount
            val factor = (100 - amount) / 100f
            fill?.setColor(Color.rgb((Color.red(accent) * factor).roundToInt(),
                (Color.green(accent) * factor).roundToInt(), (Color.blue(accent) * factor).roundToInt()))
        }

        private fun release() {
            motion?.cancel()
            if (!animates()) { setPressure(0); return }
            motion = ValueAnimator.ofInt(pressure, 0).apply {
                duration = 145
                addUpdateListener { setPressure(it.animatedValue as Int) }
                start()
            }
        }

        // Paint behind the actual child content. Preserve the platform ripple and RN's
        // border/background layers, including when a theme update replaces the drawable.
        private fun applyBacking(view: View) {
            val original = view.background
            val layers = original as? LayerDrawable ?: LayerDrawable(listOfNotNull(original).toTypedArray())
            val existing = layers.findDrawableByLayerId(fillLayerId) as? GradientDrawable
            fill = existing ?: GradientDrawable().also {
                it.cornerRadius = if (reactId(view) == "frame-tv-focus-surface") view.height / 2f else dp(10).toFloat()
                layers.setId(layers.addLayer(it), fillLayerId)
            }
            if (original !== layers) view.background = layers
            // LayerDrawable.addLayer does not lay out a newly appended child until
            // its own bounds change. A focused, already-laid-out row needs it now.
            fill?.setBounds(0, 0, view.width, view.height)
            backing = layers
            setPressure(pressure)
            view.invalidate()
        }

        private fun colorLabels(view: View, paint: Paint) {
            if (view is TextView || (view is SvgView && view.width <= dp(48) && view.height <= dp(48))) {
                if (view.layerType == View.LAYER_TYPE_NONE) {
                    view.setLayerType(View.LAYER_TYPE_HARDWARE, paint)
                    inked.add(view)
                }
            } else if (view is ViewGroup) {
                for (i in 0 until view.childCount) colorLabels(view.getChildAt(i), paint)
            }
        }

        private fun clearFocusPaint() {
            motion?.cancel()
            fill?.setColor(Color.TRANSPARENT)
            nativeHint?.let { hint -> surface?.overlay?.remove(hint) }
            nativeHint = null
            inked.forEach { it.setLayerType(View.LAYER_TYPE_NONE, null) }
            inked.clear()
            surface?.invalidate()
            fill = null
            backing = null
            surface = null
            painted = null
            pressure = 0
        }

        private fun paint() {
            val target = hovered ?: root.findFocus()?.takeUnless { root.isInTouchMode }
            if (!root.hasWindowFocus() || target == null || target === root || !target.isEnabled ||
                !target.isShown || target is WebView) {
                if (painted != null) clearFocusPaint()
                return
            }
            val colors = paletteView.get()?.let { reactId(it) }
            if (colors != paletteId && colors != null) {
                clearFocusPaint()
                paletteId = colors
                val (_, active, ink) = colors.split(':')
                accent = Color.parseColor(active)
                foreground = Color.parseColor(ink)
            }
            if (painted === target) {
                surface?.let { if (backing != null && it.background !== backing) applyBacking(it) }
                return
            }
            clearFocusPaint()
            painted = target
            val group = target as? ViewGroup
            val chip = group?.let { (0 until it.childCount).map(it::getChildAt).firstOrNull { child ->
                reactId(child) == "frame-tv-focus-surface"
            } }
            val face = chip ?: target
            surface = face
            if (face is EditText || face is CompoundButton || face !is ViewGroup) {
                // Keep the native caret, hint text and switch position legible.
                nativeHint = GradientDrawable().apply {
                    cornerRadius = dp(10).toFloat()
                    setColor(accent)
                    alpha = 72
                    setBounds(0, 0, face.width, face.height)
                    face.overlay.add(this)
                }
                return
            }
            applyBacking(face)
            val ink = Paint().apply { colorFilter = PorterDuffColorFilter(foreground, PorterDuff.Mode.SRC_IN) }
            for (i in 0 until face.childCount) colorLabels(face.getChildAt(i), ink)
        }

        private fun interactiveAt(view: View, x: Float, y: Float): View? {
            if (!view.isShown || !view.isEnabled) return null
            view.getLocationOnScreen(location)
            if (x < location[0] || y < location[1] || x >= location[0] + view.width || y >= location[1] + view.height) return null
            if (view is WebView) return null
            if (view is ViewGroup) for (index in view.childCount - 1 downTo 0) {
                interactiveAt(view.getChildAt(index), x, y)?.let { return it }
            }
            return view.takeIf { it.isClickable }
        }

        override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_HOVER_ENTER, MotionEvent.ACTION_HOVER_MOVE -> hovered = interactiveAt(root, event.rawX, event.rawY)
                MotionEvent.ACTION_HOVER_EXIT -> hovered = null
            }
            root.invalidate()
            return original.dispatchGenericMotionEvent(event)
        }

        override fun dispatchTouchEvent(event: MotionEvent): Boolean {
            if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                hovered = interactiveAt(root, event.rawX, event.rawY)
                if (hovered != null) {
                    paint()
                    motion?.cancel()
                    setPressure(15)
                    root.invalidate()
                }
            }
            if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
                release()
                hovered = null
            }
            return original.dispatchTouchEvent(event)
        }

        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            hovered = null
            val focus = root.findFocus()
            if (focus == null || focus is WebView || focus is EditText || !event.hasNoModifiers()) {
                return original.dispatchKeyEvent(event)
            }
            val select = event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER ||
                event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER || event.keyCode == KeyEvent.KEYCODE_BUTTON_A
            if (select && focus.isClickable && focus.isEnabled) {
                if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                    motion?.cancel()
                    setPressure(15)
                } else if (event.action == KeyEvent.ACTION_UP) release()
                val originalSound = focus.isSoundEffectsEnabled
                if (reactId(focus)?.startsWith("frame-tv-cue-") != true) focus.isSoundEffectsEnabled = false
                try { return original.dispatchKeyEvent(event) }
                finally { focus.isSoundEffectsEnabled = originalSound }
            }
            if (original.dispatchKeyEvent(event)) return true
            if (event.action != KeyEvent.ACTION_DOWN) return false
            val direction = when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> View.FOCUS_LEFT
                KeyEvent.KEYCODE_DPAD_RIGHT -> View.FOCUS_RIGHT
                KeyEvent.KEYCODE_DPAD_UP -> View.FOCUS_UP
                KeyEvent.KEYCODE_DPAD_DOWN -> View.FOCUS_DOWN
                else -> return false
            }
            // Perform the same spatial focus move as Android, omitting its navigation
            // chime. Widgets get first refusal above, including controls that scroll.
            val next = focus.focusSearch(direction) ?: return false
            if (next === focus || !next.isDescendantOf(root) || !focus.isDescendantOf(root)) return false
            focus.getFocusedRect(previousBounds)
            root.offsetDescendantRectToMyCoords(focus, previousBounds)
            root.offsetRectIntoDescendantCoords(next, previousBounds)
            return next.requestFocus(direction, previousBounds)
        }

        private fun View.isDescendantOf(ancestor: View): Boolean {
            var view: View? = this
            while (view != null) {
                if (view === ancestor) return true
                view = view.parent as? View
            }
            return false
        }
    }
}
