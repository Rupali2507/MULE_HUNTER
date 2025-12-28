package securityforensics.ja3;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecurityConfig {
    
    private final JA3Filter ja3Filter;
    
    public SecurityConfig(JA3Filter ja3Filter) {
        this.ja3Filter = ja3Filter;
    }
    
    @Bean
    public FilterRegistrationBean<JA3Filter> ja3FilterRegistration() {
        FilterRegistrationBean<JA3Filter> registration = new FilterRegistrationBean<>();
        registration.setFilter(ja3Filter);
        registration.addUrlPatterns("/api/*");
        registration.setOrder(1);
        System.out.println("🛡️  JA3 Bot Filter ACTIVATED");
        return registration;
    }
}
