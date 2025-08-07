import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Landing = () => {
  // FAQ
  const faqs = [
    {
      question: "What's the point of Meanwhile?",
      answer: "Meanwhile is a tool to help you and your friends coordinate schedules. You can create a group, add events to your group, and see what times work for everyone."
    },
    {
      question: "How do friends create or join a group?",
      answer: "After signing up, click 'Create' in the Groups section, enter a group name, and you'll get a 6-character code to share with friends. If you already made a Meanwhile page, you can share your group code with friends. They can sign up and enter the code in the 'Join' tab to instantly join your group."
    },
    {
      question: "How can I report bugs?",
      answer: (
        <>
          Reach out to Arik Karim on{" "}
          <a 
            href="https://linkedin.com/in/arikkarim" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline font-medium"
          >
            LinkedIn
          </a>
          .
        </>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 font-body">
      {/* Header */}
      <header className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold font-heading bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Meanwhile
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="font-medium font-body">
                Log In
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium font-body">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <span className="trace-border inline-block mb-6 text-blue-700 font-body px-3 py-1.5 rounded-full text-xs font-medium">
            ✨ No email required • Sign up instantly
          </span>
          
          <h2 className="text-5xl md:text-7xl font-bold mb-8 font-heading bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent leading-tight">
            Schedule with friends,
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              effortlessly
            </span>
          </h2>
          
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed font-body">
            Create shared weekly calendars, find free time together, and coordinate with friends without the scheduling headache.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-3 text-lg font-body">
                Start Scheduling <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-body">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Free forever • No download required
            </div>
          </div>
        </div>
        
        {/* Floating elements */}
        <div className="absolute top-20 left-10 opacity-20">
          <Calendar className="h-16 w-16 text-blue-500 animate-pulse" />
        </div>
        <div className="absolute top-40 right-16 opacity-20">
          <Users className="h-12 w-12 text-purple-500 animate-bounce" />
        </div>
        <div className="absolute bottom-20 left-1/4 opacity-20">
          <Clock className="h-10 w-10 text-pink-500 animate-pulse" />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-6 font-heading bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
              Frequently Asked Questions
            </h3>
            <p className="text-xl text-slate-600 dark:text-slate-300 font-body">
              Everything you need to know about Meanwhile
            </p>
          </div>
          
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardContent className="p-8">
              <Accordion type="single" collapsible className="space-y-4">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-left font-semibold text-lg hover:text-blue-600 transition-colors font-heading">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 dark:text-slate-300 text-base leading-relaxed pt-2 font-body">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto text-center max-w-3xl">
          <h3 className="text-4xl font-bold text-white mb-6 font-heading">
            Ready to simplify your group scheduling?
          </h3>
          <p className="text-xl text-blue-100 mb-10 font-body">
            Join your friends already coordinating schedules better with Meanwhile.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-3 text-lg font-body">
              Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-900 text-slate-300">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Calendar className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-bold text-white font-heading">Meanwhile</span>
          </div>
          <p className="text-sm font-body">
            © 2025 Arik Karim
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing; 