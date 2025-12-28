package securityforensics.ja3;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
public class JA3Filter implements Filter {
    
    private final BotDetectionService botService;
    
    public JA3Filter(BotDetectionService botService) {
        this.botService = botService;
    }
    
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        
        JA3FingerprintService fingerprintService = new JA3FingerprintService();
        String ja3 = fingerprintService.generateFingerprint(request);
        
        if (botService.isBot(ja3)) {
            response.setStatus(403);
            response.getWriter().write("Blocked: Bot Detected");
            return;
        }
        
        chain.doFilter(req, res);
    }
}
