package studio.frame.tv

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import kotlin.math.roundToInt

/** One outline per activity window, including during scrolls and React view recycling. */
object RemoteFocus {
    fun install(activity: Activity) {
        val config = activity.resources.configuration
        if ((config.uiMode and Configuration.UI_MODE_TYPE_MASK) != Configuration.UI_MODE_TYPE_TELEVISION) return
        val root = activity.window.decorView
        val density = activity.resources.displayMetrics.density
        fun dp(value: Int) = (value * density).roundToInt()
        fun outline(color: Int) = GradientDrawable().apply {
            setColor(Color.TRANSPARENT)
            cornerRadius = dp(9).toFloat()
            setStroke(dp(2), color)
        }
        val ring = LayerDrawable(arrayOf(outline(Color.WHITE), outline(Color.rgb(43, 73, 87)))).apply {
            setLayerInset(1, dp(2), dp(2), dp(2), dp(2))
        }
        val visible = Rect()
        ring.setVisible(false, false)
        root.overlay.add(ring)
        root.viewTreeObserver.addOnGlobalFocusChangeListener { _, _ -> root.invalidate() }
        root.viewTreeObserver.addOnPreDrawListener {
            val target = root.findFocus()
            val show = root.hasWindowFocus() && !root.isInTouchMode && target != null &&
                target !== root && target.getGlobalVisibleRect(visible)
            if (show && ring.bounds != visible) ring.bounds = visible
            if (ring.isVisible != show) ring.setVisible(show, false)
            true
        }
    }
}
